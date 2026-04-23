import { SELError, SELEvaluationError } from "@seljs/common";

import type { SELDiagnostic } from "@seljs/checker";

// Re-export shared errors from @seljs/common
export { SELError, SELEvaluationError };

/**
 * Thrown when contract validation or execution fails.
 * Includes optional contract name and method name for context.
 * When the failure is a contract revert, the decoded revert reason and raw
 * revert data are exposed on `revertReason` / `revertData`, and `decodedError`
 * carries any matched custom-error name + args from the contract's ABI.
 */
export class SELContractError extends SELError {
	public readonly contractName?: string;
	public readonly methodName?: string;
	public readonly revertReason?: string;
	public readonly revertData?: `0x${string}`;
	public readonly decodedError?: { name: string; args: readonly unknown[] };

	public constructor(
		message: string,
		options?: {
			cause?: unknown;
			contractName?: string;
			methodName?: string;
			revertReason?: string;
			revertData?: `0x${string}`;
			decodedError?: { name: string; args: readonly unknown[] };
		},
	) {
		super(message, { cause: options?.cause });
		this.contractName = options?.contractName;
		this.methodName = options?.methodName;
		this.revertReason = options?.revertReason;
		this.revertData = options?.revertData;
		this.decodedError = options?.decodedError;
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
 * When an individual sub-call reverts, `revertReason` / `revertData` carry the
 * decoded reason text and raw return data, and `decodedError` carries any
 * matched custom-error name + args from the contract's ABI.
 */
export class MulticallBatchError extends SELError {
	public readonly failedCallIndex?: number;
	public readonly contractName?: string;
	public readonly methodName?: string;
	public readonly revertReason?: string;
	public readonly revertData?: `0x${string}`;
	public readonly decodedError?: { name: string; args: readonly unknown[] };

	public constructor(
		message: string,
		options?: {
			cause?: unknown;
			failedCallIndex?: number;
			contractName?: string;
			methodName?: string;
			revertReason?: string;
			revertData?: `0x${string}`;
			decodedError?: { name: string; args: readonly unknown[] };
		},
	) {
		super(message, { cause: options?.cause });
		this.failedCallIndex = options?.failedCallIndex;
		this.contractName = options?.contractName;
		this.methodName = options?.methodName;
		this.revertReason = options?.revertReason;
		this.revertData = options?.revertData;
		this.decodedError = options?.decodedError;
	}
}

/**
 * Thrown when the provided client fails validation or is misconfigured.
 */
export class SELClientError extends SELError {
	public override readonly name = "SELClientError";
}

/**
 * Thrown when lint rules with error severity detect violations.
 * Contains the diagnostics that caused the failure.
 */
export class SELLintError extends SELError {
	public readonly diagnostics: SELDiagnostic[];

	public constructor(
		diagnostics: SELDiagnostic[],
		options?: { cause?: unknown },
	) {
		const messages = diagnostics.map((d) => d.message).join("; ");
		super(`Expression lint failed: ${messages}`, options);
		this.diagnostics = diagnostics;
	}
}
