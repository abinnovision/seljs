import { SELError, SELParseError, SELTypeError } from "@seljs/common";

// Re-export shared errors from @seljs/common
export { SELError, SELParseError, SELTypeError };

/**
 * Thrown when CEL expression evaluation fails.
 * Wraps cel-js EvaluationError with additional context.
 */
export class SELEvaluationError extends SELError {}

/**
 * Thrown when contract validation or execution fails.
 * Includes optional contract name and method name for context.
 */
export class SELContractError extends SELError {
	public readonly contractName?: string;
	public readonly methodName?: string;

	public constructor(
		message: string,
		options?: { cause?: unknown; contractName?: string; methodName?: string },
	) {
		super(message, { cause: options?.cause });
		this.contractName = options?.contractName;
		this.methodName = options?.methodName;
	}
}

/**
 * Thrown when a circular dependency is detected in the call dependency graph.
 * Indicates that call A depends on call B which depends on call A (directly or transitively).
 */
export class CircularDependencyError extends SELError {
	public readonly callIds: string[];

	public constructor(
		message: string,
		options?: { cause?: unknown; callIds?: string[] },
	) {
		super(message, { cause: options?.cause });
		this.callIds = options?.callIds ?? [];
	}
}

/**
 * Thrown when execution limits are exceeded (maxRounds or maxCalls).
 * Prevents infinite loops and runaway execution.
 */
export class ExecutionLimitError extends SELError {
	public readonly limitType: "maxRounds" | "maxCalls";
	public readonly limit: number;
	public readonly actual: number;

	public constructor(
		message: string,
		options?: {
			cause?: unknown;
			limitType?: "maxRounds" | "maxCalls";
			limit?: number;
			actual?: number;
		},
	) {
		super(message, { cause: options?.cause });
		this.limitType = options?.limitType ?? "maxRounds";
		this.limit = options?.limit ?? 0;
		this.actual = options?.actual ?? 0;
	}
}

/**
 * Thrown when a Multicall3 batch execution fails.
 * Includes the failed call index and optional contract name/method name for context.
 */
export class MulticallBatchError extends SELError {
	public readonly failedCallIndex?: number;
	public readonly contractName?: string;
	public readonly methodName?: string;

	public constructor(
		message: string,
		options?: {
			cause?: unknown;
			failedCallIndex?: number;
			contractName?: string;
			methodName?: string;
		},
	) {
		super(message, { cause: options?.cause });
		this.failedCallIndex = options?.failedCallIndex;
		this.contractName = options?.contractName;
		this.methodName = options?.methodName;
	}
}
