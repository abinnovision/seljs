import { readContract } from "viem/actions";

import { createReplayCallId } from "./replay-cache.js";
import { createLogger } from "../debug.js";
import { ExecutionLimitError, SELContractError } from "../errors/index.js";

import type { CelCodecRegistry } from "@seljs/checker";
import type { ContractSchema, MethodSchema } from "@seljs/schema";
import type { Abi, Address, PublicClient } from "viem";

const debug = createLogger("contract-caller");

/**
 * Tracks total RPC calls (pre-executed + live) across a single evaluation.
 * Create one per `evaluate()` call and pass it through the handler closure.
 */
export class CallCounter {
	private count = 0;
	public constructor(
		private readonly maxCalls: number,
		initialCount: number = 0,
	) {
		this.count = initialCount;
	}

	public increment(contractName: string, methodName: string): void {
		this.count++;
		if (this.count > this.maxCalls) {
			throw new ExecutionLimitError(
				`Execution limit exceeded: ${String(this.count)} calls exceeds maxCalls (${String(this.maxCalls)})`,
				{
					limitType: "maxCalls",
					limit: this.maxCalls,
					actual: this.count,
				},
			);
		}

		debug(
			"call count: %d/%d (%s.%s)",
			this.count,
			this.maxCalls,
			contractName,
			methodName,
		);
	}
}

export const executeContractCall = async (
	contract: ContractSchema,
	method: MethodSchema,
	args: unknown[],
	options: {
		executionCache?: Map<string, unknown>;
		client?: PublicClient;
		codecRegistry?: CelCodecRegistry;
		callCounter?: CallCounter;
	},
	// eslint-disable-next-line max-params
): Promise<unknown> => {
	const normalizedArgs = options.codecRegistry
		? args.map((arg, i) =>
				options.codecRegistry!.encode(method.params[i]?.type ?? "dyn", arg),
			)
		: args;

	if (options.executionCache) {
		const callId = createReplayCallId(
			contract.name,
			method.name,
			normalizedArgs,
		);
		if (options.executionCache.has(callId)) {
			debug("cache hit: %s.%s", contract.name, method.name);

			return options.executionCache.get(callId);
		}

		debug("cache miss: %s.%s — executing live", contract.name, method.name);
	}

	if (!options.client) {
		throw new SELContractError(
			"No client provided for contract call. Provide a client in SELRuntime config or evaluate() context.",
			{
				contractName: contract.name,
				methodName: method.name,
			},
		);
	}

	// Count live RPC calls against the limit
	options.callCounter?.increment(contract.name, method.name);

	try {
		return await readContract(options.client, {
			address: contract.address,
			abi: [method.abi] as unknown as Abi,
			functionName: method.name,
			args: normalizedArgs as readonly unknown[],
		});
	} catch (error) {
		if (error instanceof SELContractError) {
			throw error;
		}

		throw new SELContractError(
			`Contract call failed: ${contract.name}.${method.name}`,
			{
				cause: error,
				contractName: contract.name,
				methodName: method.name,
			},
		);
	}
};

export const resolveExecutionBlockNumber = async (
	client: PublicClient,
): Promise<bigint | undefined> => {
	const clientWithGetBlockNumber = client as PublicClient & {
		getBlockNumber?: () => Promise<bigint>;
		request?: unknown;
	};

	if (typeof clientWithGetBlockNumber.getBlockNumber === "function") {
		return await clientWithGetBlockNumber.getBlockNumber();
	}

	if (typeof clientWithGetBlockNumber.request === "function") {
		return undefined;
	}

	return 0n;
};

export const buildContractInfoMap = (
	contracts: ContractSchema[],
): Map<string, { abi: Abi; address: Address }> => {
	const map = new Map<string, { abi: Abi; address: Address }>();
	for (const contract of contracts) {
		const abi = contract.methods.map((m) => m.abi) as unknown as Abi;
		map.set(contract.name, { abi, address: contract.address });
	}

	return map;
};
