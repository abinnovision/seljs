import { EVM_CONSTANTS, SOLIDITY_TYPES } from "@seljs/types";

import type {
	FunctionSchema,
	MacroSchema,
	TypeSchema,
	VariableSchema,
} from "@seljs/schema";

/**
 * Built-in CEL functions available in SEL expressions.
 * These functions are part of the CEL standard library.
 */
export const CEL_BUILTIN_FUNCTIONS: FunctionSchema[] = [
	{
		name: "size",
		signature: "size(list|map|string|bytes): int",
		description: "Returns the size of a collection or string",
		params: [{ name: "value", type: "list|map|string|bytes" }],
		returns: "int",
	},
	{
		name: "size",
		signature: "string.size(): int",
		description: "Returns the length of the string",
		params: [],
		returns: "int",
		receiverType: "string",
	},
	{
		name: "size",
		signature: "list.size(): int",
		description: "Returns the number of elements in the list",
		params: [],
		returns: "int",
		receiverType: "list",
	},
	{
		name: "size",
		signature: "map.size(): int",
		description: "Returns the number of entries in the map",
		params: [],
		returns: "int",
		receiverType: "map",
	},
	{
		name: "size",
		signature: "bytes.size(): int",
		description: "Returns the number of bytes",
		params: [],
		returns: "int",
		receiverType: "bytes",
	},
	{
		name: "type",
		signature: "type(value): type",
		description: "Returns the type of a value",
		params: [{ name: "value", type: "any" }],
		returns: "type",
	},
	{
		name: "int",
		signature: "int(value): int",
		description: "Converts a value to an integer",
		params: [{ name: "value", type: "any" }],
		returns: "int",
	},
	{
		name: "uint",
		signature: "uint(value): uint",
		description: "Converts a value to an unsigned integer",
		params: [{ name: "value", type: "any" }],
		returns: "uint",
	},
	{
		name: "double",
		signature: "double(value): double",
		description: "Converts a value to a double",
		params: [{ name: "value", type: "any" }],
		returns: "double",
	},
	{
		name: "string",
		signature: "string(value): string",
		description: "Converts a value to a string",
		params: [{ name: "value", type: "any" }],
		returns: "string",
	},
	{
		name: "bytes",
		signature: "bytes(value): bytes",
		description: "Converts a value to bytes",
		params: [{ name: "value", type: "any" }],
		returns: "bytes",
	},
	{
		name: "dyn",
		signature: "dyn(value): dyn",
		description: "Converts a value to a dynamic type",
		params: [{ name: "value", type: "any" }],
		returns: "dyn",
	},
	{
		name: "bool",
		signature: "bool(value): bool",
		description: "Converts a value to a boolean",
		params: [{ name: "value", type: "string" }],
		returns: "bool",
	},
	{
		name: "solInt",
		signature: "solInt(string): sol_int",
		description:
			"Converts a string or int to a sol_int (arbitrary-precision integer)",
		params: [{ name: "value", type: "string|int" }],
		returns: "sol_int",
	},
	{
		name: "solAddress",
		signature: "solAddress(string): sol_address",
		description: "Converts a hex string to a sol_address type",
		params: [{ name: "value", type: "string" }],
		returns: "sol_address",
	},
	{
		name: "parseUnits",
		signature: "parseUnits(string|int|double|sol_int, int|sol_int): sol_int",
		description:
			"Scales a human-readable value by 10^decimals, producing a sol_int. Mirrors viem/ethers parseUnits. The decimals argument accepts either a plain int or a sol_int (e.g. the return of token.decimals()).",
		params: [
			{ name: "value", type: "string|int|double|sol_int" },
			{ name: "decimals", type: "int|sol_int" },
		],
		returns: "sol_int",
	},
	{
		name: "formatUnits",
		signature: "formatUnits(sol_int|int, int|sol_int): double",
		description:
			"Scales a sol_int down by 10^decimals, producing a double for readable comparisons. The decimals argument accepts either a plain int or a sol_int (e.g. the return of token.decimals()).",
		params: [
			{ name: "value", type: "sol_int|int" },
			{ name: "decimals", type: "int|sol_int" },
		],
		returns: "double",
	},
	{
		name: "min",
		signature: "min(sol_int|int, sol_int|int): sol_int",
		description: "Returns the smaller of two integer values",
		params: [
			{ name: "a", type: "sol_int|int" },
			{ name: "b", type: "sol_int|int" },
		],
		returns: "sol_int",
	},
	{
		name: "max",
		signature: "max(sol_int|int, sol_int|int): sol_int",
		description: "Returns the larger of two integer values",
		params: [
			{ name: "a", type: "sol_int|int" },
			{ name: "b", type: "sol_int|int" },
		],
		returns: "sol_int",
	},
	{
		name: "abs",
		signature: "abs(sol_int|int): sol_int",
		description: "Returns the absolute value of an integer",
		params: [{ name: "value", type: "sol_int|int" }],
		returns: "sol_int",
	},
	{
		name: "balance",
		signature: "sol_address.balance(): sol_int",
		description: "Returns the native ETH balance of the address in wei",
		params: [],
		returns: "sol_int",
		receiverType: "sol_address",
	},
	{
		name: "isZeroAddress",
		signature: "isZeroAddress(sol_address|string): bool",
		description:
			"Returns true if the address is the zero address (0x0000...0000)",
		params: [{ name: "address", type: "sol_address|string" }],
		returns: "bool",
	},
	{
		name: "timestamp",
		signature: "timestamp(string): timestamp",
		description: "Parses a timestamp string",
		params: [{ name: "value", type: "string" }],
		returns: "timestamp",
	},
	{
		name: "duration",
		signature: "duration(string): duration",
		description: "Parses a duration string",
		params: [{ name: "value", type: "string" }],
		returns: "duration",
	},
	{
		name: "matches",
		signature: "string.matches(pattern): bool",
		description: "Tests if a string matches a regex pattern",
		params: [{ name: "pattern", type: "string" }],
		returns: "bool",
		receiverType: "string",
	},
	{
		name: "contains",
		signature: "string.contains(substring): bool",
		description: "Tests if a string contains a substring",
		params: [{ name: "substring", type: "string" }],
		returns: "bool",
		receiverType: "string",
	},
	{
		name: "startsWith",
		signature: "string.startsWith(prefix): bool",
		description: "Tests if a string starts with a prefix",
		params: [{ name: "prefix", type: "string" }],
		returns: "bool",
		receiverType: "string",
	},
	{
		name: "endsWith",
		signature: "string.endsWith(suffix): bool",
		description: "Tests if a string ends with a suffix",
		params: [{ name: "suffix", type: "string" }],
		returns: "bool",
		receiverType: "string",
	},
];

/**
 * Built-in CEL macros available in SEL expressions.
 * Macros are syntactic sugar that expand to function calls.
 */
export const CEL_BUILTIN_MACROS: MacroSchema[] = [
	{
		name: "all",
		pattern: "list.all(identifier, predicate)",
		description: "Returns true if all elements satisfy the predicate",
		example: "tokens.all(t, t.balance > 0)",
	},
	{
		name: "exists",
		pattern: "list.exists(identifier, predicate)",
		description: "Returns true if any element satisfies the predicate",
		example: "users.exists(u, u.isAdmin)",
	},
	{
		name: "exists_one",
		pattern: "list.exists_one(identifier, predicate)",
		description: "Returns true if exactly one element satisfies the predicate",
		example: "tokens.exists_one(t, t.id == 123)",
	},
	{
		name: "map",
		pattern: "list.map(identifier, transform)",
		description: "Transforms each element in the list",
		example: "tokens.map(t, t.balance)",
	},
	{
		name: "map",
		pattern: "list.map(identifier, predicate, transform)",
		description: "Transforms elements that satisfy the predicate",
		example: "tokens.map(t, t.balance > 0, t.balance)",
	},
	{
		name: "filter",
		pattern: "list.filter(identifier, predicate)",
		description: "Filters elements by predicate",
		example: "users.filter(u, u.age >= 18)",
	},
	{
		name: "has",
		pattern: "has(e.f)",
		description: "Tests if a field exists on an object",
		example: "has(user.email)",
	},
	{
		name: "cel.bind",
		pattern: "cel.bind(var, value, expr)",
		description: "Binds a variable for use in an expression",
		example: "cel.bind(x, user.balance, x > 1000)",
	},
];

/**
 * Primitive types from Solidity available in SEL.
 * These are the basic type building blocks for the schema.
 */
export const SOLIDITY_PRIMITIVE_TYPES: TypeSchema[] = [
	// Solidity types from the registry (address, bytes)
	...SOLIDITY_TYPES.map((it) => {
		/*
		 * The registry contains both built-in and custom types.
		 * We only want to include the custom types here, since the built-in types are already included as CEL primitives below.
		 */
		if (it.type !== "custom") {
			return null;
		}

		return {
			name: it.name,
			kind: "primitive",
			description: it.schema.description,
		} satisfies TypeSchema;
	}).filter((it) => it !== null),

	// CEL builtins presented as Solidity primitives for editor tooling
	{
		name: "bool",
		kind: "primitive",
		description: "Boolean value (true or false)",
	},
	{
		name: "string",
		kind: "primitive",
		description: "UTF-8 string",
	},
	{
		name: "bytes32",
		kind: "primitive",
		description: "32-byte fixed array",
	},
];

/**
 * Top-level `sol_int` constants exposed in every SEL environment.
 * Sourced from `@seljs/types` so the runtime registration and the schema
 * metadata never drift apart.
 */
export const CEL_BUILTIN_CONSTANTS: VariableSchema[] = EVM_CONSTANTS.map(
	(c) => ({
		name: c.name,
		type: "sol_int",
		description: c.description,
	}),
);
