/**
 * Infers the TypeScript type for a CEL type string.
 * Handles primitives and list<T>.
 */
type InferCelType<T extends ContextCelType> =
	T extends `list<${infer E extends PrimitiveCelType}>`
		? CelTypeToTs[E][]
		: T extends keyof CelTypeToTs
			? CelTypeToTs[T]
			: never;

/**
 * Resolves a ContextFieldDefinition to its ContextCelType.
 */
type ResolveCelType<T extends ContextFieldDefinition> = T extends ContextCelType
	? T
	: T extends { type: infer U extends ContextCelType }
		? U
		: never;

/**
 * Primitive CEL types valid for user-defined context variables.
 */
export type PrimitiveCelType =
	| "sol_int"
	| "sol_address"
	| "bool"
	| "string"
	| "bytes";

/**
 * All CEL types valid for user-defined context variables.
 * Includes primitives and list<primitive>.
 */
export type ContextCelType = PrimitiveCelType | `list<${PrimitiveCelType}>`;

/**
 * Maps primitive CEL type names to their TypeScript representation.
 */
export interface CelTypeToTs {
	sol_int: bigint;
	sol_address: `0x${string}`;
	bool: boolean;
	string: string;
	bytes: string;
}

/**
 * A context field can be a bare CEL type string or an object with type and description.
 */
export type ContextFieldDefinition =
	| ContextCelType
	| { type: ContextCelType; description: string };

/**
 * Flat definition of context variables: key is the variable name, value is the CEL type or a typed object with description.
 */
export type ContextDefinition = Record<string, ContextFieldDefinition>;

/**
 * Infers the TypeScript type of context values from a ContextDefinition.
 *
 * @example
 * ```ts
 * type Ctx = InferContext<{ user: "sol_address"; amount: "sol_int" }>;
 * // { user: `0x${string}`; amount: bigint }
 *
 * type CtxList = InferContext<{ addrs: "list<sol_address>" }>;
 * // { addrs: `0x${string}`[] }
 * ```
 */
export type InferContext<T extends ContextDefinition> = {
	[K in keyof T]: InferCelType<ResolveCelType<T[K]>>;
};
