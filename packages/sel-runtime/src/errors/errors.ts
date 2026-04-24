import {
	SELError,
	SELEvaluationError,
	SELRuntimeError,
	SELStaticError,
} from "@seljs/common";

import type { SELDiagnostic } from "@seljs/checker";

// Re-export shared bases from @seljs/common for convenience.
export { SELError, SELEvaluationError, SELRuntimeError, SELStaticError };

/**
 * Thrown when a contract-layer call fails after execution reached the
 * chain (unknown method, ABI decode mismatch, etc.). Reverts are reported
 * as {@link SELContractRevertError}, a subclass; batch-level Multicall3
 * failures as {@link SELMulticallBatchError}.
 */
export class SELContractError extends SELRuntimeError {
	public readonly contractName?: string;
	public readonly methodName?: string;

	public constructor(
		message: string,
		options?: {
			cause?: unknown;
			contractName?: string;
			methodName?: string;
		},
	) {
		super(message, { cause: options?.cause });
		this.contractName = options?.contractName;
		this.methodName = options?.methodName;
	}
}

/**
 * Thrown when a contract call reverted. Carries the decoded revert
 * reason, raw revert data, and — when the selector matched a custom
 * error in the contract's ABI — the decoded custom-error name and args.
 */
export class SELContractRevertError extends SELContractError {
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
		super(message, {
			cause: options?.cause,
			contractName: options?.contractName,
			methodName: options?.methodName,
		});
		this.revertReason = options?.revertReason;
		this.revertData = options?.revertData;
		this.decodedError = options?.decodedError;
	}
}

/**
 * Thrown when a Multicall3 batch fails at the batch level — the aggregate
 * call itself reverted, or individual calls could not be encoded/decoded.
 * Individual sub-call reverts surface as {@link SELContractRevertError},
 * not as this class.
 */
export class SELMulticallBatchError extends SELContractError {
	public readonly failedCallIndex?: number;

	public constructor(
		message: string,
		options?: {
			cause?: unknown;
			failedCallIndex?: number;
			contractName?: string;
			methodName?: string;
		},
	) {
		super(message, {
			cause: options?.cause,
			contractName: options?.contractName,
			methodName: options?.methodName,
		});
		this.failedCallIndex = options?.failedCallIndex;
	}
}

/**
 * Base for failures from the JSON-RPC transport or node — the call never
 * reached the contract. Transport errors (HTTP, WebSocket, timeout) use
 * {@link SELProviderTransportError}; node-reported JSON-RPC errors use
 * {@link SELProviderRpcError}. Catch the base to retry safely against an
 * alternate RPC.
 */
export class SELProviderError extends SELRuntimeError {}

/**
 * Thrown when the transport layer (HTTP, WebSocket) or a timeout
 * prevented the request from reaching the node.
 */
export class SELProviderTransportError extends SELProviderError {
	public readonly httpStatus?: number;
	public readonly url?: string;
	public readonly body?: string;

	public constructor(
		message: string,
		options?: {
			cause?: unknown;
			httpStatus?: number;
			url?: string;
			body?: string;
		},
	) {
		super(message, { cause: options?.cause });
		this.httpStatus = options?.httpStatus;
		this.url = options?.url;
		this.body = options?.body;
	}
}

/**
 * Thrown when the node returned a JSON-RPC error response (rate limit,
 * invalid params, unsupported method, user rejection, etc.).
 */
export class SELProviderRpcError extends SELProviderError {
	public readonly rpcCode?: number;
	public readonly rpcData?: unknown;
	public readonly method?: string;

	public constructor(
		message: string,
		options?: {
			cause?: unknown;
			rpcCode?: number;
			rpcData?: unknown;
			method?: string;
		},
	) {
		super(message, { cause: options?.cause });
		this.rpcCode = options?.rpcCode;
		this.rpcData = options?.rpcData;
		this.method = options?.method;
	}
}

/**
 * Base for failures from the execution-framework layer that sits between
 * parsed expressions and contract calls (dependency analysis, round
 * planning). Concrete subclasses: {@link SELExecutionLimitError},
 * {@link SELCircularDependencyError}.
 */
export class SELExecutionError extends SELRuntimeError {}

/**
 * Thrown when a circular dependency is detected in the call dependency
 * graph. Indicates that call A depends on call B which depends on call A
 * (directly or transitively).
 */
export class SELCircularDependencyError extends SELExecutionError {
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
export class SELExecutionLimitError extends SELExecutionError {
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
 * Thrown when the provided client fails validation or is misconfigured.
 */
export class SELClientError extends SELStaticError {
	public override readonly name = "SELClientError";
}

/**
 * Thrown when lint rules with error severity detect violations.
 * Contains the diagnostics that caused the failure.
 */
export class SELLintError extends SELStaticError {
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
