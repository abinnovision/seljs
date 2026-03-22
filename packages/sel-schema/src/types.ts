import type { AbiFunction } from "abitype";

/**
 * Type reference string used throughout the schema.
 * These are CEL type names like "int", "string", "bool", or custom types defined in the schema.
 * For parameterized types, use CEL syntax (e.g., "list<sol_address>").
 */
export type TypeRef = string;

/**
 * Root schema type for SEL expression language.
 * Contains all contracts, variables, types, functions, and macros available in a SEL environment.
 */
export interface SELSchema {
	/**
	 * Schema format version
	 */
	version: string;

	/**
	 * Available contracts and their methods
	 */
	contracts: ContractSchema[];

	/**
	 * Variables available in expressions (e.g., "user", "blockNumber")
	 */
	variables: VariableSchema[];

	/**
	 * Type definitions (primitives, structs, enums)
	 */
	types: TypeSchema[];

	/**
	 * Built-in CEL functions
	 */
	functions: FunctionSchema[];

	/**
	 * CEL macros (all, exists, map, filter, etc.)
	 */
	macros: MacroSchema[];

	/**
	 * Names of features that are enabled in this schema.
	 */
	enabledFeatures?: string[];
}

/**
 * Describes what a feature contributes to the schema when enabled.
 * Feature definitions are library-internal — users only pass feature flags,
 * not definitions.
 */
export interface SELFeatureDefinition {
	/**
	 *  Unique feature name (e.g., "addressState", "storage")
	 */
	name: string;

	/**
	 *  Human-readable description
	 */
	description: string;

	/**
	 *  Variables contributed to the schema when enabled
	 */
	variables?: VariableSchema[];

	/**
	 * Functions contributed to the schema when enabled
	 */
	functions?: FunctionSchema[];

	/**
	 * Types contributed to the schema when enabled
	 */
	types?: TypeSchema[];
}

/**
 * User-facing configuration for enabling features.
 * Keys are feature names, values are booleans.
 */
export type SELFeatureConfig = Record<string, boolean>;

/**
 * Schema for a contract with available methods.
 * Methods are view/pure functions that can be called in CEL expressions.
 */
export interface ContractSchema {
	/**
	 * Identifier used in expressions: erc20.balanceOf(...)
	 */
	name: string;

	/**
	 * Contract address (for display/documentation)
	 */
	address: `0x${string}`;

	/**
	 * Human-readable description
	 */
	description?: string;

	/**
	 * Available methods (view/pure functions only)
	 */
	methods: MethodSchema[];
}

/**
 * Schema for a contract method.
 * Represents a view or pure function that can be called in CEL expressions.
 */
export interface MethodSchema {
	/**
	 * Method name: "balanceOf"
	 */
	name: string;

	/**
	 * From NatSpec @notice or custom
	 */
	description?: string;

	/**
	 * Method parameters
	 */
	params: ParamSchema[];

	/** Raw ABI function entry for viem encoding/decoding */
	abi: AbiFunction;

	/**
	 * Return type reference
	 */
	returns: TypeRef;

	/**
	 * For autocomplete grouping
	 */
	category?: string;
}

/**
 * Schema for a method parameter or type field.
 * Used in methods, structs, and function signatures.
 */
export interface ParamSchema {
	/**
	 * Parameter name: "owner"
	 */
	name: string;

	/**
	 * Type reference: "address", "uint256", etc.
	 */
	type: TypeRef;

	/**
	 * From NatSpec @param or custom
	 */
	description?: string;
}

/**
 * Schema for a variable available in CEL expressions.
 * Represents runtime context values like "user", "blockNumber", etc.
 */
export interface VariableSchema {
	/**
	 * Variable name available in expressions
	 */
	name: string;

	/**
	 * Type reference
	 */
	type: TypeRef;

	/**
	 * Description for hover/documentation
	 */
	description?: string;

	/**
	 * Example value for documentation
	 */
	example?: string;

	/**
	 * The feature that contributed this variable, if any.
	 * Set automatically by the schema builder when merging feature contributions.
	 */
	feature?: string;
}

/**
 * Schema for a type definition.
 * These are reusable types that can be used in method signatures, variable types, and function signatures.
 */
export interface TypeSchema {
	/**
	 * Type name
	 */
	name: string;

	/**
	 * Type category
	 */
	kind: "primitive" | "struct";

	/**
	 * For structs: field definitions
	 */
	fields?: ParamSchema[];

	/**
	 * Description
	 */
	description?: string;

	/**
	 * The feature that contributed this type, if any.
	 * Set automatically by the schema builder when merging feature contributions.
	 */
	feature?: string;
}

/**
 * Schema for a built-in CEL function.
 *
 * Functions are either **free functions** (`size(list)`) or
 * **receiver methods** (`string.startsWith(prefix)`).
 * When `receiverType` is set, the function is a method that can only be
 * called on expressions of that type using dot-syntax.
 */
export interface FunctionSchema {
	/**
	 * Function name: "size", "string", "int", "startsWith"
	 */
	name: string;

	/**
	 * Function signature for display
	 *
	 * e.g., "size(list<T>): int" | "string.startsWith(prefix): bool"
	 */
	signature: string;

	/**
	 * Description
	 */
	description?: string;

	/**
	 * Parameter documentation (excludes the receiver for methods)
	 */
	params: ParamSchema[];

	/**
	 * Return type
	 */
	returns: TypeRef;

	/**
	 * When set, this function is a receiver method on the given type.
	 * E.g., `receiverType: "string"` means it is called as `expr.name(...)`.
	 */
	receiverType?: TypeRef;

	/**
	 * The feature that contributed this function, if any.
	 * Set automatically by the schema builder when merging feature contributions.
	 */
	feature?: string;
}

/**
 * Schema for a CEL macro.
 * Macros are syntactic sugar that expand to function calls.
 */
export interface MacroSchema {
	/**
	 * Macro name: "all", "exists", "map", "filter"
	 */
	name: string;

	/**
	 * Usage pattern
	 *
	 * e.g., "list.all(x, predicate)" | "list.map(x, transform)"
	 */
	pattern: string;

	/**
	 * Description
	 */
	description?: string;

	/**
	 * Example
	 */
	example?: string;
}
