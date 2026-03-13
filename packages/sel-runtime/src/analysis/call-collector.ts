import { COMPREHENSION_MACROS, SCALAR_WRAPPER_FUNCTIONS } from "@seljs/checker";
import { isAstNode } from "@seljs/common";

import { createLogger } from "../debug.js";

import type { CallArgument, CollectedCall } from "./types.js";
import type { ASTNode } from "@marcbachmann/cel-js";

/** Minimal interface required by collectCalls for contract lookup. */
export interface ContractLookup {
	get: (name: string) => unknown;
}

const debug = createLogger("analysis:collect");

/**
 * Generates a deterministic call identifier from contract name, method, and arguments.
 *
 * Format: "contract:method:arg1,arg2,..."
 * Used for deduplication and dependency tracking between calls.
 */
const generateCallId = (
	contract: string,
	method: string,
	args: CallArgument[],
): string => {
	const argKey = args
		.map((arg) => {
			if (arg.variableName !== undefined) {
				return arg.variableName;
			}

			if (arg.value !== undefined) {
				const v = arg.value;

				return typeof v === "string" ||
					typeof v === "number" ||
					typeof v === "boolean" ||
					typeof v === "bigint"
					? String(v)
					: "?";
			}

			if (arg.dependsOnCallId !== undefined) {
				return arg.dependsOnCallId;
			}

			return "?";
		})
		.join(",");

	return `${contract}:${method}:${argKey}`;
};

/**
 * Attempts to extract a scalar argument from a Solidity cast/wrapper call
 * (e.g. `uint256(42)`, `solAddress("0x...")`, `int256(tokenId)`).
 *
 * Handles both literal values and variable references.
 * Returns undefined if the node is not a recognized scalar wrapper.
 */
const collectScalarArgument = (argNode: unknown): CallArgument | undefined => {
	if (!isAstNode(argNode) || argNode.op !== "call") {
		return undefined;
	}

	// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
	if (!Array.isArray(argNode.args) || argNode.args.length !== 2) {
		return undefined;
	}

	const fnName: unknown = argNode.args[0];
	const fnArgs: unknown = argNode.args[1];

	if (
		typeof fnName !== "string" ||
		!Array.isArray(fnArgs) ||
		fnArgs.length !== 1 ||
		!SCALAR_WRAPPER_FUNCTIONS.has(fnName)
	) {
		return undefined;
	}

	const inner: unknown = (fnArgs as unknown[])[0];
	if (!isAstNode(inner)) {
		return undefined;
	}

	if (inner.op === "value") {
		return { type: "literal", value: inner.args };
	}

	if (inner.op === "id" && typeof inner.args === "string") {
		return { type: "variable", variableName: inner.args };
	}

	return undefined;
};

/**
 * Extracts the method name, receiver identifier, and argument nodes from an rcall AST node.
 *
 * An rcall node has the structure: `["methodName", receiverNode, [argNodes...]]`
 */
const getRCallArgs = (
	node: ASTNode,
): { method: string; receiverName?: string; args: unknown[] } | undefined => {
	if (!Array.isArray(node.args) || node.args.length < 3) {
		return undefined;
	}

	const methodNode: unknown = (node.args as unknown[])[0];
	const receiverNode: unknown = (node.args as unknown[])[1];
	const argNodes: unknown = (node.args as unknown[])[2];

	if (typeof methodNode !== "string" || !Array.isArray(argNodes)) {
		return undefined;
	}

	let receiverName: string | undefined;
	if (
		isAstNode(receiverNode) &&
		receiverNode.op === "id" &&
		typeof receiverNode.args === "string"
	) {
		receiverName = receiverNode.args;
	}

	return { method: methodNode, receiverName, args: argNodes };
};

/**
 * Collects contract calls from a CEL AST by traversing the tree.
 *
 * Walks the AST looking for `rcall` nodes whose receiver matches a registered
 * contract. For each matched call, classifies arguments as literals, variable
 * references, or results of other contract calls (creating dependency edges).
 * Skips `cel.bind()` calls while still collecting any nested contract calls.
 *
 * @param ast The root AST node from a parsed CEL expression
 * @param registry Contract lookup to validate receiver names against
 * @returns Array of collected calls with dependency information
 */
export const collectCalls = (
	ast: ASTNode,
	registry: ContractLookup,
): CollectedCall[] => {
	const calls: CollectedCall[] = [];

	/** Variable names that are scoped (comprehension iteration vars, cel.bind vars) — NOT user context */
	const scopedVars = new Set<string>();

	/** rcall AST nodes skipped because they have unresolvable args */
	const deferredNodes = new WeakSet<ASTNode>();

	const traverse = (node: unknown): void => {
		if (Array.isArray(node)) {
			for (const item of node) {
				traverse(item);
			}

			return;
		}

		if (!isAstNode(node)) {
			return;
		}

		if (node.op === "rcall") {
			collectRCall(node);

			return;
		}

		traverse(node.args);
	};

	/**
	 * Handles cel.bind() — registers the bind variable name for the body scope,
	 * traverses the initializer and body, then removes the scoped var.
	 */
	const handleCelBind = (args: unknown[]): void => {
		if (args.length >= 3) {
			const nameNode = args[0];
			if (
				isAstNode(nameNode) &&
				nameNode.op === "id" &&
				typeof nameNode.args === "string"
			) {
				traverse(args[1]);
				scopedVars.add(nameNode.args);
				traverse(args[2]);
				scopedVars.delete(nameNode.args);

				return;
			}
		}

		for (const argNode of args) {
			traverse(argNode);
		}
	};

	/**
	 * Handles rcall nodes whose receiver is NOT a registered contract.
	 * Traverses the receiver node and args, registering comprehension
	 * iteration variables for their body scope.
	 */
	const handleNonContractRCall = (
		node: ASTNode,
		method: string,
		args: unknown[],
	): void => {
		// Always traverse the receiver to collect contract calls within it
		if (Array.isArray(node.args) && node.args.length >= 2) {
			traverse((node.args as unknown[])[1]);
		}

		// Comprehension macros: register iteration variable for body scope
		if (COMPREHENSION_MACROS.has(method) && args.length >= 2) {
			const iterVarNode = args[0];
			if (
				isAstNode(iterVarNode) &&
				iterVarNode.op === "id" &&
				typeof iterVarNode.args === "string"
			) {
				scopedVars.add(iterVarNode.args);
				for (let i = 1; i < args.length; i++) {
					traverse(args[i]);
				}

				scopedVars.delete(iterVarNode.args);

				return;
			}
		}

		for (const argNode of args) {
			traverse(argNode);
		}
	};

	/**
	 * Classifies a single argument node, returning the resolved CallArgument
	 * or `undefined` if unresolvable. When `undefined` is returned, the caller
	 * should mark the parent call as deferred.
	 */
	const classifyArg = (
		argNode: unknown,
	): { arg: CallArgument | undefined; traversed: boolean } => {
		const scalarArg = collectScalarArgument(argNode);
		if (scalarArg) {
			return { arg: scalarArg, traversed: false };
		}

		if (isAstNode(argNode) && argNode.op === "value") {
			return {
				arg: { type: "literal", value: argNode.args },
				traversed: false,
			};
		}

		if (
			isAstNode(argNode) &&
			argNode.op === "id" &&
			typeof argNode.args === "string"
		) {
			if (scopedVars.has(argNode.args)) {
				return { arg: undefined, traversed: false };
			}

			return {
				arg: { type: "variable", variableName: argNode.args },
				traversed: false,
			};
		}

		if (isAstNode(argNode) && argNode.op === "rcall") {
			const innerCall = collectRCall(argNode);
			if (innerCall) {
				return {
					arg: { type: "call_result", dependsOnCallId: innerCall.id },
					traversed: true,
				};
			}

			// Inner rcall was not collected — check if it was deferred
			if (deferredNodes.has(argNode)) {
				// inner calls already collected by recursive collectRCall
				return { arg: undefined, traversed: true };
			}
		}

		return { arg: undefined, traversed: false };
	};

	/**
	 * Processes an rcall AST node, collecting it as a contract call if the
	 * receiver is a registered contract. Recursively processes nested rcalls
	 * in arguments to build dependency chains.
	 */
	const collectRCall = (node: ASTNode): CollectedCall | undefined => {
		const callArgs = getRCallArgs(node);
		if (!callArgs) {
			traverse(node.args);

			return undefined;
		}

		const { method, receiverName, args } = callArgs;

		if (receiverName === "cel" && method === "bind") {
			handleCelBind(args);

			return undefined;
		}

		if (!receiverName || !registry.get(receiverName)) {
			handleNonContractRCall(node, method, args);

			return undefined;
		}

		const collectedArgs: CallArgument[] = [];
		let hasUnresolvableArg = false;

		for (const argNode of args) {
			const { arg, traversed } = classifyArg(argNode);
			if (arg) {
				collectedArgs.push(arg);
			} else {
				hasUnresolvableArg = true;
				if (!traversed) {
					traverse(argNode);
				}
			}
		}

		if (hasUnresolvableArg) {
			deferredNodes.add(node);
			debug("deferred %s.%s (unresolvable args)", receiverName, method);

			return undefined;
		}

		const call: CollectedCall = {
			id: generateCallId(receiverName, method, collectedArgs),
			contract: receiverName,
			method,
			args: collectedArgs,
			astNode: node,
		};

		calls.push(call);
		debug("found %s.%s (id=%s)", receiverName, method, call.id);

		return call;
	};

	// Start traversal from the root of the AST
	traverse(ast);

	debug("collected %d total calls", calls.length);

	return calls;
};
