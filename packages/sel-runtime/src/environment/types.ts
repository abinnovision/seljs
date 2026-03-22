import type { SELClient } from "./client.js";
import type { SELCheckerOptions } from "@seljs/checker";
import type { SELSchema } from "@seljs/schema";

/**
 * Options for multicall3 batching of contract calls.
 *
 * When multiple independent contract calls are executed in the same round,
 * they are batched into a single multicall3 RPC request for efficiency.
 */
export interface MulticallOptions {
	/** Maximum number of calls per multicall3 batch. Unbounded if omitted. */
	batchSize?: number;

	/** Custom multicall3 contract address. Defaults to the canonical deployment. */
	address?: `0x${string}`;
}

/**
 * Limits for contract call execution.
 *
 * Execution limits (`maxRounds`, `maxCalls`) bound the multi-round contract
 * execution engine. An {@link ExecutionLimitError} is thrown when exceeded.
 */
export interface SELLimits {
	/** Maximum number of dependency-ordered execution rounds (default: 10) */
	maxRounds?: number;

	/** Maximum total number of contract calls across all rounds (default: 100) */
	maxCalls?: number;
}

/**
 * Configuration for creating an immutable {@link SELRuntime}.
 *
 * All contracts and context must be declared here — the environment
 * cannot be mutated after construction.
 */
export interface SELRuntimeConfig extends SELCheckerOptions {
	/** SEL schema describing contracts, variables, types, functions, and macros */
	schema: SELSchema;

	/** Client for on-chain reads. Any viem PublicClient or SELClient-compatible object. */
	client?: SELClient;

	/** Multicall3 batching options for contract call execution */
	multicall?: MulticallOptions;

	/** Execution limits for contract call rounds and total calls */
	limits?: SELLimits;
}
