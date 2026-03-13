import type { ContextDefinition } from "@seljs/types";
import type { Abi, Address } from "viem";

/**
 * Asserts which completion items appear (or don't) at a given cursor offset.
 */
export interface CompletionAssertion {
	/**
	 * Cursor position (0-based character offset) within the expression.
	 */
	offset: number;

	/**
	 * Completion labels that MUST be present.
	 */
	includes?: string[];

	/**
	 * Completion labels that MUST NOT be present.
	 */
	excludes?: string[];
}

/**
 * Asserts the inferred type of the node at a given cursor offset.
 */
export interface TypeAtAssertion {
	/**
	 * Cursor position (0-based character offset) within the expression.
	 */
	offset: number;

	/**
	 * Expected inferred type name (e.g. `"sol_int"`, `"SEL_Struct_pool_getReserveData"`).
	 */
	type: string;
}

/**
 * Asserts the expected (contextual) type at a given cursor offset.
 */
export interface ExpectedTypeAtAssertion {
	/**
	 * Cursor position (0-based character offset) within the expression.
	 */
	offset: number;

	/**
	 * Expected contextual type name.
	 */
	expectedType: string;

	/**
	 * Where the expectation originates — an operator position or a function argument slot.
	 */
	context?: "operator" | "function-argument";
}

/**
 * Asserts properties of a struct type generated from the ABI schema.
 */
export interface SchemaStructAssertion {
	/**
	 * Struct type name as it appears in the SEL schema (e.g. `"SEL_Struct_pool_getReserveData"`).
	 */
	name: string;

	/**
	 * Expected number of fields on the struct.
	 */
	fieldCount: number;

	/**
	 * Subset of field names that MUST be present (order-independent).
	 */
	fields?: string[];
}

/**
 * A single e2e test case for an SEL expression.
 *
 * Every case requires an `expr` and `expectedType`. Additional optional fields
 * opt-in to extra assertion passes (evaluation, completions, typeAt, etc.)
 * that the test runner executes when present.
 */
export interface TestCase {
	/**
	 * Optional label — auto-generated from `expr → expectedType` when omitted.
	 */
	label?: string;

	/**
	 * The SEL expression to test.
	 */
	expr: string;

	/**
	 * Expected result type (ignored when `invalid` is true).
	 */
	expectedType: string;

	/**
	 * When true, the expression is expected to fail type-checking.
	 */
	invalid?: boolean;

	/**
	 * Minimum number of diagnostics the checker must report for invalid expressions.
	 */
	minDiagnostics?: number;

	/**
	 * Mock return values keyed by ABI function name — triggers the evaluate pass.
	 */
	mocks?: Record<string, unknown>;

	/**
	 * Runtime context variables supplied to `env.evaluate()`.
	 */
	context?: Record<string, unknown>;

	/**
	 * Expected evaluation result value.
	 */
	expectedValue?: unknown;

	/**
	 * Expected number of evaluation rounds (for multi-round nested calls).
	 */
	expectedRounds?: number;

	/**
	 * Completion assertions at specific cursor offsets.
	 */
	completions?: CompletionAssertion[];

	/**
	 * Type-at assertions at specific cursor offsets.
	 */
	typeAt?: TypeAtAssertion[];

	/**
	 * Expected-type assertions at specific cursor offsets.
	 */
	expectedTypeAt?: ExpectedTypeAtAssertion[];
}

/**
 * A named group of e2e test cases that share a set of ABI contracts and context.
 *
 * Each group maps to a top-level `describe` block produced by the test runner,
 * with nested blocks for each assertion pass (check, invalid, evaluate, etc.).
 */
export interface AbiFixtureGroup {
	/**
	 * Human-readable group name used as the `describe` block label.
	 */
	name: string;

	/**
	 * Named contracts with their ABIs and addresses, referenced in expressions as `contractName.fn()`.
	 */
	contracts: Record<string, { abi: Abi; address: Address }>;

	/**
	 * Optional context definition for typed context variables available in expressions.
	 */
	context?: ContextDefinition;

	/**
	 * Test cases belonging to this group.
	 */
	cases: TestCase[];

	/**
	 * Group-level schema assertions (struct shapes derived from the ABI).
	 */
	schema?: {
		structs?: SchemaStructAssertion[];
	};
}
