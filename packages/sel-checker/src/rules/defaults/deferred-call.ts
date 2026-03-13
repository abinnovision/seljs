import { isAstNode } from "@seljs/common";

import {
	COMPREHENSION_MACROS,
	SCALAR_WRAPPER_FUNCTIONS,
} from "../../constants.js";
import { walkAST } from "../../utils/index.js";

import type { SELDiagnostic } from "../../checker/checker.js";
import type { RuleContext, SELRule } from "../types.js";
import type { ASTNode } from "@marcbachmann/cel-js";

/**
 * Checks whether a scalar wrapper inner value (inside solInt/solAddress) is resolvable.
 */
const isScalarInnerResolvable = (
	inner: unknown,
	scopedVars: Set<string>,
): boolean => {
	if (!isAstNode(inner)) {
		return false;
	}

	if (inner.op === "value") {
		return true;
	}

	return (
		inner.op === "id" &&
		typeof inner.args === "string" &&
		!scopedVars.has(inner.args)
	);
};

/**
 * Checks whether a call node is a resolvable scalar wrapper (solInt/solAddress).
 */
const isResolvableScalarWrapper = (
	node: ASTNode,
	scopedVars: Set<string>,
): boolean => {
	const nodeArgs = node.args as unknown[];
	const fnName = nodeArgs[0];
	const fnArgs = nodeArgs[1];

	if (
		typeof fnName !== "string" ||
		!SCALAR_WRAPPER_FUNCTIONS.has(fnName) ||
		!Array.isArray(fnArgs) ||
		fnArgs.length !== 1
	) {
		return false;
	}

	return isScalarInnerResolvable(fnArgs[0], scopedVars);
};

/**
 * Checks whether a single argument node is statically resolvable
 * (literal, context variable, or nested contract call result).
 */
const isResolvableArg = (
	argNode: unknown,
	contractNames: Set<string>,
	scopedVars: Set<string>,
): boolean => {
	if (!isAstNode(argNode)) {
		return false;
	}

	// Scalar wrapper: solInt(...), solAddress(...)
	if (argNode.op === "call") {
		return isResolvableScalarWrapper(argNode, scopedVars);
	}

	// Literal value
	if (argNode.op === "value") {
		return true;
	}

	// Variable reference — resolvable only if NOT scoped
	if (argNode.op === "id" && typeof argNode.args === "string") {
		return !scopedVars.has(argNode.args);
	}

	// Nested contract call result — resolvable (will be pre-executed)
	if (argNode.op === "rcall") {
		return isContractRCall(argNode, contractNames);
	}

	return false;
};

/**
 * Checks whether an rcall node targets a registered contract.
 */
const isContractRCall = (
	node: ASTNode,
	contractNames: Set<string>,
): boolean => {
	const nodeArgs = node.args as unknown[];
	const receiverNode = nodeArgs[1];

	return (
		isAstNode(receiverNode) &&
		receiverNode.op === "id" &&
		typeof receiverNode.args === "string" &&
		contractNames.has(receiverNode.args)
	);
};

/**
 * Extracts the rcall components: method name, receiver node, and argument list.
 */
const parseRCallNode = (
	node: ASTNode,
):
	| {
			method: string;
			receiver: unknown;
			callArgs: unknown[];
	  }
	| undefined => {
	const nodeArgs = node.args as unknown[];
	const method = nodeArgs[0];
	const receiver = nodeArgs[1];
	const callArgs = nodeArgs[2];

	if (typeof method !== "string" || !Array.isArray(callArgs)) {
		return undefined;
	}

	return { method, receiver, callArgs };
};

/**
 * Tracks scoped variables introduced by comprehension macros or cel.bind().
 */
const trackScopedVars = (
	parsed: { method: string; receiver: unknown; callArgs: unknown[] },
	scopedVars: Set<string>,
): void => {
	const { method, receiver, callArgs } = parsed;

	// Comprehension iteration variables
	if (
		isAstNode(receiver) &&
		receiver.op !== "id" &&
		COMPREHENSION_MACROS.has(method) &&
		callArgs.length >= 1
	) {
		const iterVarNode: unknown = callArgs[0];
		if (
			isAstNode(iterVarNode) &&
			iterVarNode.op === "id" &&
			typeof iterVarNode.args === "string"
		) {
			scopedVars.add(iterVarNode.args);
		}
	}

	// cel.bind() variables
	if (
		method === "bind" &&
		isAstNode(receiver) &&
		receiver.op === "id" &&
		receiver.args === "cel" &&
		callArgs.length >= 1
	) {
		const nameNode: unknown = callArgs[0];
		if (
			isAstNode(nameNode) &&
			nameNode.op === "id" &&
			typeof nameNode.args === "string"
		) {
			scopedVars.add(nameNode.args);
		}
	}
};

/**
 * Flags contract calls whose arguments cannot be resolved statically,
 * meaning they will execute as live RPC calls at evaluation time instead
 * of being batched via multicall.
 *
 * This includes calls with arguments that depend on:
 * - Comprehension iteration variables (map/filter/exists)
 * - cel.bind() scoped variables
 * - Arithmetic or other expressions on call results
 * - Struct field access on call results
 */
export const deferredCall: SELRule = {
	name: "deferred-call",
	description:
		"Flags contract calls with dynamic arguments that cannot be batched via multicall.",
	defaultSeverity: "info",
	tier: "structural",

	run(context: RuleContext): SELDiagnostic[] {
		const contractNames = new Set(context.schema.contracts.map((c) => c.name));

		if (contractNames.size === 0) {
			return [];
		}

		const diagnostics: SELDiagnostic[] = [];
		const scopedVars = new Set<string>();

		walkAST(context.ast, (node) => {
			if (node.op !== "rcall") {
				return;
			}

			const parsed = parseRCallNode(node);
			if (!parsed) {
				return;
			}

			const { method, callArgs } = parsed;

			// Track scoped variables
			trackScopedVars(parsed, scopedVars);

			// Only check contract calls
			if (!isContractRCall(node, contractNames)) {
				return;
			}

			const receiverNode = (node.args as unknown[])[1] as ASTNode;
			const contractName = receiverNode.args as string;

			// Check if any argument is unresolvable
			const hasDeferred = callArgs.some(
				(argNode) => !isResolvableArg(argNode, contractNames, scopedVars),
			);

			if (hasDeferred) {
				diagnostics.push(
					context.report(
						node,
						`\`${contractName}.${method}()\` has dynamic arguments and will execute as a live RPC call instead of being batched.`,
					),
				);
			}
		});

		return diagnostics;
	},
};
