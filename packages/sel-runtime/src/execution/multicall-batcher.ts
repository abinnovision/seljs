import { readContract } from "viem/actions";

import {
	MULTICALL3_ADDRESS,
	type MulticallCall,
	type MulticallResult,
	multicall3Abi,
} from "./multicall.js";
import { createLogger } from "../debug.js";
import { MulticallBatchError } from "../errors/index.js";

import type { Address, Hex, PublicClient } from "viem";

const debug = createLogger("execute:multicall");

export class MulticallBatcher {
	private readonly address: Address;
	private readonly batchSize: number;

	public constructor(
		private readonly client: PublicClient,
		options?: { address?: Address; batchSize?: number },
	) {
		this.address = options?.address ?? MULTICALL3_ADDRESS;
		this.batchSize = options?.batchSize ?? 200;
	}

	public async executeBatch(
		calls: MulticallCall[],
		blockNumber: bigint,
	): Promise<MulticallResult[]> {
		if (calls.length === 0) {
			return [];
		}

		if (calls.length <= this.batchSize) {
			debug("batch: %d calls (single chunk)", calls.length);

			return await this.executeChunk(calls, blockNumber);
		}

		debug(
			"batch: %d calls (chunked, batchSize=%d)",
			calls.length,
			this.batchSize,
		);
		const results: MulticallResult[] = [];
		for (let i = 0; i < calls.length; i += this.batchSize) {
			const chunk = calls.slice(i, i + this.batchSize);
			debug(
				"chunk %d/%d",
				i / this.batchSize + 1,
				Math.ceil(calls.length / this.batchSize),
			);
			const chunkResults = await this.executeChunk(chunk, blockNumber);
			results.push(...chunkResults);
		}

		return results;
	}

	private async executeChunk(
		calls: MulticallCall[],
		blockNumber: bigint,
	): Promise<MulticallResult[]> {
		try {
			const result = (await readContract(this.client, {
				address: this.address,
				abi: multicall3Abi,
				functionName: "aggregate3",
				args: [calls],
				blockNumber,
			})) as readonly { success: boolean; returnData: Hex }[];

			return result.map((r) => ({
				success: r.success,
				returnData: r.returnData,
			}));
		} catch (error) {
			throw new MulticallBatchError("Multicall3 aggregate3 call failed", {
				cause: error,
			});
		}
	}
}
