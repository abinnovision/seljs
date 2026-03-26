import type { SELClient } from "../environment/client.js";
import type { SELDiagnostic } from "@seljs/checker";

/**
 * Metadata about the execution.
 * Contains statistics and block information from the execution run.
 */
export interface ExecutionMeta {
	/**
	 * Number of rounds executed (topological depth)
	 */
	roundsExecuted: number;

	/**
	 *  Total number of contract calls executed
	 */
	totalCalls: number;

	/**
	 * Block number at which calls were executed
	 */
	blockNumber: bigint;
}

/**
 * Result of executing an SEL expression with contract calls.
 * Maps call IDs to their decoded results.
 */
export interface ExecutionResult {
	/**
	 * Map of callId to decoded result value
	 */
	results: Map<string, unknown>;

	/**
	 *  Execution metadata
	 */
	meta: ExecutionMeta;
}

/**
 * Context passed to the executor for running contract calls.
 * Contains the block number and variable bindings.
 */
export interface ExecutionContext {
	/**
	 *  Block number for consistent reads across all calls
	 */
	blockNumber: bigint;

	/**
	 *  Variable name to value mapping from evaluate() context
	 */
	variables: Record<string, unknown>;
}

/**
 * Options for the evaluate() call.
 */
export interface EvaluateOptions {
	/**
	 * Override client for this evaluation
	 */
	client?: SELClient;
}

/**
 * Result of evaluating a SEL expression.
 *
 * Always returned by `evaluate()`. The `meta` field is present when
 * contract calls were executed, absent for pure CEL expressions.
 */
export interface EvaluateResult<T = unknown> {
	/**
	 *  The evaluated result value
	 */
	value: T;

	/**
	 *  The inferred type of the expression, when available
	 */
	type?: string;

	/**
	 *  Execution metadata, present when contract calls were executed
	 */
	meta?: ExecutionMeta;

	/**
	 *  Advisory diagnostics (warnings/info) from lint rules, when non-empty
	 */
	diagnostics?: SELDiagnostic[];
}
