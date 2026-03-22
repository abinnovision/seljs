import { AbiFunction } from "ox";

import {
	MULTICALL3_ADDRESS,
	type MulticallCall,
	type MulticallResult,
	multicall3Function,
} from "./multicall.js";
import { createLogger } from "../debug.js";
import { MulticallBatchError } from "../errors/index.js";

import type { SELClient } from "../environment/client.js";

const debug = createLogger("execute:multicall");

export class MulticallBatcher {
	private readonly address: `0x${string}`;
	private readonly batchSize: number;

	public constructor(
		private readonly client: SELClient,
		options?: { address?: `0x${string}`; batchSize?: number },
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
			const data = AbiFunction.encodeData(multicall3Function, [calls]);

			const response = await this.client.call({
				to: this.address,
				data,
				blockNumber,
			});

			if (!response.data) {
				throw new MulticallBatchError("Multicall3 aggregate3 returned no data");
			}

			const decoded = AbiFunction.decodeResult(
				multicall3Function,
				response.data,
			);

			return (
				decoded as readonly { success: boolean; returnData: `0x${string}` }[]
			).map((r) => ({
				success: r.success,
				returnData: r.returnData,
			}));
		} catch (error) {
			if (error instanceof MulticallBatchError) {
				throw error;
			}

			throw new MulticallBatchError("Multicall3 aggregate3 call failed", {
				cause: error,
			});
		}
	}
}
