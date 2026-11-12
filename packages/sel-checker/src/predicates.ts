import { isAstNode } from "@seljs/common";

import type { SELSchema } from "@seljs/schema";

const BUILTIN_BLOCK_FIELDS: readonly BuiltinBlockField[] = [
	"number",
	"timestamp",
];

/** Variable types a scalar wrapper may pre-resolve before evaluation. */
const SCALAR_WRAPPER_VAR_TYPES: Record<string, ReadonlySet<string>> = {
	solInt: new Set(["sol_int", "int", "string"]),
	solAddress: new Set(["sol_address", "string"]),
};

/** Identifier of the builtin block context. */
export const BUILTIN_BLOCK_NAME = "block";

/** Fields exposed by the builtin `block` identifier. */
export type BuiltinBlockField = "number" | "timestamp";

/**
 * The builtin `block` is available unless the schema defines a contract or
 * variable named `block`, which then shadows it.
 */
export const isBuiltinBlockActive = (
	schema: Pick<SELSchema, "contracts" | "variables">,
): boolean =>
	!schema.contracts.some((c) => c.name === BUILTIN_BLOCK_NAME) &&
	!schema.variables.some((v) => v.name === BUILTIN_BLOCK_NAME);

/**
 * Returns the builtin block field selected by `block.<field>`, or undefined
 * when the node is not such a select or `block` is a scoped variable.
 */
export const getBuiltinBlockField = (
	node: unknown,
	scopedVars: ReadonlySet<string>,
): BuiltinBlockField | undefined => {
	if (!isAstNode(node) || node.op !== ".") {
		return undefined;
	}

	const [receiver, field] = node.args;
	if (
		receiver.op !== "id" ||
		receiver.args !== BUILTIN_BLOCK_NAME ||
		scopedVars.has(BUILTIN_BLOCK_NAME)
	) {
		return undefined;
	}

	return BUILTIN_BLOCK_FIELDS.find((f) => f === field);
};

/**
 * Returns the contract name for a `<contract>.address` select, or undefined.
 */
export const getContractAddressSelect = (
	node: unknown,
	scopedVars: ReadonlySet<string>,
	isContract: (name: string) => boolean,
): string | undefined => {
	if (!isAstNode(node) || node.op !== ".") {
		return undefined;
	}

	const [receiver, field] = node.args;
	if (
		field !== "address" ||
		receiver.op !== "id" ||
		scopedVars.has(receiver.args) ||
		!isContract(receiver.args)
	) {
		return undefined;
	}

	return receiver.args;
};

/**
 * Whether `fn(<variable of varType>)` can be resolved before evaluation.
 * Unknown or undeclared variable types are not resolvable.
 */
export const isResolvableScalarWrapperVar = (
	fn: string,
	varType: string | undefined,
): boolean =>
	varType !== undefined &&
	(SCALAR_WRAPPER_VAR_TYPES[fn]?.has(varType) ?? false);
