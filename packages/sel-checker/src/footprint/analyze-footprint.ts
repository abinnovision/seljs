import {
	contractTypeName,
	SELParseError,
	SELTypeCheckError,
} from "@seljs/common";
import { toFunctionSelector, toFunctionSignature } from "viem";

import { createCheckerEnvironment } from "../environment/hydrate.js";
import { toCelLiteralType } from "../environment/value-wrappers.js";
import { collectChildren } from "../utils/index.js";

import type { ASTNode, ParseResult } from "@marcbachmann/cel-js";
import type {
	ContractFootprint,
	ContractSchema,
	FootprintMethod,
	FootprintResult,
	MethodSchema,
	SELSchema,
} from "@seljs/schema";

/**
 * Builtins that read chain state, keyed `<receiverType>.<name>`.
 * Mirrors the runtime special case for native balance lookups.
 */
const CHAIN_STATE_FUNCTIONS = new Set(["sol_address.balance"]);

interface CelType {
	name: string;
	kind: string;
	unwrappedType: CelType;
	hasDynType: boolean;
}

interface CelFunctionDeclaration {
	name: string;
	receiverType: CelType | null;
	argTypes: CelType[];
}

interface CelCandidates {
	declarations: CelFunctionDeclaration[];
	findFunction: (
		argTypes: CelType[],
		receiverType?: CelType,
	) => CelFunctionDeclaration | null;
}

/**
 * Properties cel-js attaches to AST nodes during `check()`
 * (`checkedType` in type-checker.js, `candidates` and `argTypes` in the
 * `rcall` handler of operators.js). Not part of the public typings.
 */
interface CheckedNode {
	checkedType?: CelType;
	candidates?: CelCandidates;
	argTypes?: CelType[];
}

type RcallNode = Extract<ASTNode, { op: "rcall" }> & CheckedNode;

const compareStrings = (a: string, b: string): number =>
	a < b ? -1 : a > b ? 1 : 0;

const normalizeType = (type: string): string => type.replace(/\s+/g, "");

const toFootprintMethod = (method: MethodSchema): FootprintMethod => ({
	name: method.name,
	selector: toFunctionSelector(method.abi),
	signature: toFunctionSignature(method.abi),
	abi: method.abi,
});

/**
 * Maps a resolved cel-js declaration to the schema method it was registered
 * from. Matches either the primary or the CEL literal overload, taking the
 * first schema method in registration order.
 */
const findSchemaMethod = (
	contract: ContractSchema,
	decl: CelFunctionDeclaration,
): MethodSchema | undefined => {
	const declTypes = decl.argTypes.map((t) => normalizeType(t.name));

	return contract.methods.find(
		(m) =>
			m.name === decl.name &&
			m.params.length === declTypes.length &&
			(m.params.every((p, i) => normalizeType(p.type) === declTypes[i]) ||
				m.params.every(
					(p, i) =>
						normalizeType(toCelLiteralType(p.type) ?? p.type) === declTypes[i],
				)),
	);
};

const typeCheck = (parsed: ParseResult): void => {
	let error: unknown;
	try {
		const result = parsed.check();
		if (result.valid) {
			return;
		}

		error = result.error;
	} catch (err) {
		error = err;
	}

	const message = error instanceof Error ? error.message : "Type check failed";

	throw new SELTypeCheckError(message, { cause: error });
};

/**
 * Statically determines every contract method, chain-state builtin, and
 * context variable an expression can reference, including untaken ternary
 * branches and comprehension bodies.
 *
 * @param expression SEL expression to analyze.
 * @param schema Schema the expression is checked against.
 * @throws {SELParseError} If the expression cannot be parsed.
 * @throws {SELTypeCheckError} If the expression does not type-check, or a
 * contract call cannot be attributed statically.
 */
export const analyzeFootprint = (
	expression: string,
	schema: SELSchema,
): FootprintResult => {
	const env = createCheckerEnvironment(schema);

	let parsed: ParseResult;
	try {
		parsed = env.parse(expression);
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		throw new SELParseError(message, { cause: error });
	}

	typeCheck(parsed);

	const contractsByType = new Map(
		schema.contracts.map((c) => [contractTypeName(c.name), c]),
	);
	const variableNames = new Set(schema.variables.map((v) => v.name));

	const methods = new Map<ContractSchema, Map<string, FootprintMethod>>();
	const builtins = new Set<string>();
	const variables = new Set<string>();

	const record = (contract: ContractSchema, method: MethodSchema): void => {
		const entry = toFootprintMethod(method);
		let byContract = methods.get(contract);
		if (!byContract) {
			byContract = new Map();
			methods.set(contract, byContract);
		}

		byContract.set(entry.selector, entry);
	};

	const recordContractCall = (
		contract: ContractSchema,
		node: RcallNode,
		receiverType: CelType,
	): void => {
		const [name] = node.args;
		const argTypes = node.argTypes ?? [];
		if (argTypes.some((t) => t.hasDynType)) {
			for (const m of contract.methods) {
				if (m.name === name && m.params.length === argTypes.length) {
					record(contract, m);
				}
			}

			return;
		}

		const decl = node.candidates?.findFunction(argTypes, receiverType);
		const method = decl ? findSchemaMethod(contract, decl) : undefined;
		if (!method) {
			throw new SELTypeCheckError(
				`Cannot resolve contract method '${contract.name}.${name}'`,
			);
		}

		record(contract, method);
	};

	const visit = (node: ASTNode, bound: ReadonlySet<string>): void => {
		if (node.op === "id") {
			if (variableNames.has(node.args) && !bound.has(node.args)) {
				variables.add(node.args);
			}

			return;
		}

		if (node.op !== "rcall") {
			for (const child of collectChildren(node)) {
				visit(child, bound);
			}

			return;
		}

		const [name, receiver, args] = node.args;
		const checked = node as RcallNode;

		if (!checked.candidates) {
			visitMacro(checked, bound);

			return;
		}

		const receiverType = (receiver as ASTNode & CheckedNode).checkedType;
		if (!receiverType) {
			throw new SELTypeCheckError(`Receiver of '${name}' was not type-checked`);
		}

		const contract = contractsByType.get(receiverType.unwrappedType.name);
		if (contract) {
			recordContractCall(contract, checked, receiverType.unwrappedType);
		} else if (receiverType.unwrappedType.kind === "dyn") {
			for (const decl of checked.candidates.declarations) {
				const receiverName = decl.receiverType?.name ?? "";
				if (contractsByType.has(receiverName)) {
					throw new SELTypeCheckError(
						`Cannot statically attribute '${name}' on a dyn receiver to a contract`,
					);
				}

				if (CHAIN_STATE_FUNCTIONS.has(`${receiverName}.${decl.name}`)) {
					builtins.add(`${receiverName}.${decl.name}`);
				}
			}
		} else if (
			CHAIN_STATE_FUNCTIONS.has(`${receiverType.unwrappedType.name}.${name}`)
		) {
			builtins.add(`${receiverType.unwrappedType.name}.${name}`);
		}

		visit(receiver, bound);
		for (const arg of args) {
			visit(arg, bound);
		}
	};

	const visitMacro = (node: RcallNode, bound: ReadonlySet<string>): void => {
		const [name, receiver, args] = node.args;
		const [binder, ...rest] = args;
		const isBind =
			name === "bind" && receiver.op === "id" && receiver.args === "cel";
		if (
			binder?.op !== "id" ||
			!(args.length === 2 || (args.length === 3 && (isBind || name === "map")))
		) {
			throw new SELTypeCheckError(`Unexpected macro shape for '${name}'`);
		}

		const inner = new Set(bound).add(binder.args);

		if (isBind) {
			const [value, body] = rest as [ASTNode, ASTNode];
			visit(value, bound);
			visit(body, inner);

			return;
		}

		visit(receiver, bound);
		for (const arg of rest) {
			visit(arg, inner);
		}
	};

	visit(parsed.ast, new Set());

	const contracts: ContractFootprint[] = [...methods.entries()]
		.map(([contract, byContract]) => ({
			name: contract.name,
			address: contract.address,
			methods: [...byContract.values()].sort((a, b) =>
				compareStrings(a.signature, b.signature),
			),
		}))
		.sort((a, b) => compareStrings(a.name, b.name));

	return {
		contracts,
		builtins: [...builtins].sort(compareStrings),
		variables: [...variables].sort(compareStrings),
	};
};
