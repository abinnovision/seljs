import { type Abi, AbiFunction } from "ox";

import { createReplayCallId } from "./replay-cache.js";
import { createLogger } from "../debug.js";
import { ExecutionLimitError, SELContractError } from "../errors/index.js";

import type { SELClient } from "./client.js";
import type { CelCodecRegistry } from "@seljs/checker";
import type { ContractSchema, MethodSchema } from "@seljs/schema";

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
		client?: SELClient;
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
		const data = AbiFunction.encodeData(
			[method.abi],
			method.name,
			normalizedArgs as readonly unknown[],
		);

		const result = await options.client.call({
			to: contract.address,
			data,
		});

		if (!result.data) {
			throw new SELContractError(
				`Contract call returned no data: ${contract.name}.${method.name}`,
				{
					contractName: contract.name,
					methodName: method.name,
				},
			);
		}

		return AbiFunction.decodeResult([method.abi], method.name, result.data);
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
	client: SELClient,
): Promise<bigint> => {
	return await client.getBlockNumber();
};

export const buildContractInfoMap = (
	contracts: ContractSchema[],
): Map<string, { abi: Abi.Abi; address: `0x${string}` }> => {
	const map = new Map<string, { abi: Abi.Abi; address: `0x${string}` }>();
	for (const contract of contracts) {
		const abi = contract.methods.map((m) => m.abi) as unknown as Abi.Abi;
		map.set(contract.name, { abi, address: contract.address });
	}

	return map;
};
