import { AbiFunction } from "ox";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { multicall3Function } from "./multicall.js";

import type { MulticallCall } from "./multicall.js";
import type { SELClient } from "../environment/client.js";

interface DecodedMulticallResult {
	success: boolean;
	returnData: `0x${string}`;
}

function encodeResults(results: DecodedMulticallResult[]): `0x${string}` {
	return AbiFunction.encodeResult(multicall3Function, results as any);
}

function makeCall(overrides: Partial<MulticallCall> = {}): MulticallCall {
	return {
		target: "0x1111111111111111111111111111111111111111",
		allowFailure: false,
		callData: "0x70a08231",
		...overrides,
	};
}

function makeResult(seed: number): DecodedMulticallResult {
	return {
		success: true,
		returnData: `0x${seed.toString(16).padStart(64, "0")}` as const,
	};
}

function makeMockClient(): SELClient {
	return {
		call: vi.fn(),
		getBlockNumber: vi.fn().mockResolvedValue(100n),
	};
}

const { MulticallBatcher } = await import("./multicall-batcher.js");

describe("src/execution/multicall-batcher.ts", () => {
	let batcher: InstanceType<typeof MulticallBatcher>;
	let mockClient: SELClient;

	beforeEach(() => {
		mockClient = makeMockClient();
		vi.mocked(mockClient.call).mockResolvedValue({
			data: encodeResults([makeResult(1)]),
		});
		batcher = new MulticallBatcher(mockClient);
	});

	it("returns empty array for empty calls without calling client", async () => {
		const results = await batcher.executeBatch([], 100n);

		expect(results).toEqual([]);
		expect(mockClient.call).not.toHaveBeenCalled();
	});

	it("executes single call using aggregate3 and blockNumber", async () => {
		const call = makeCall();
		const expectedResult = makeResult(7);
		vi.mocked(mockClient.call).mockResolvedValue({
			data: encodeResults([expectedResult]),
		});

		const results = await batcher.executeBatch([call], 200n);

		expect(mockClient.call).toHaveBeenCalledTimes(1);
		const callArgs = vi.mocked(mockClient.call).mock.calls[0]![0];
		expect(callArgs.blockNumber).toBe(200n);
		expect(results).toEqual([expectedResult]);
	});

	it("batches multiple calls within batchSize into single aggregate3 request", async () => {
		const calls = [makeCall(), makeCall({ callData: "0x1234" })];
		vi.mocked(mockClient.call).mockResolvedValue({
			data: encodeResults([makeResult(1), makeResult(2)]),
		});

		const results = await batcher.executeBatch(calls, 300n);

		expect(mockClient.call).toHaveBeenCalledTimes(1);
		const callArgs = vi.mocked(mockClient.call).mock.calls[0]![0];
		expect(callArgs.blockNumber).toBe(300n);
		expect(results).toHaveLength(2);
	});

	it("chunks calls exceeding batchSize into multiple aggregate3 requests", async () => {
		const chunkedBatcher = new MulticallBatcher(mockClient, { batchSize: 2 });
		const calls = [
			makeCall({ callData: "0x01" }),
			makeCall({ callData: "0x02" }),
			makeCall({ callData: "0x03" }),
			makeCall({ callData: "0x04" }),
			makeCall({ callData: "0x05" }),
		];

		vi.mocked(mockClient.call)
			.mockResolvedValueOnce({
				data: encodeResults([makeResult(1), makeResult(2)]),
			})
			.mockResolvedValueOnce({
				data: encodeResults([makeResult(3), makeResult(4)]),
			})
			.mockResolvedValueOnce({ data: encodeResults([makeResult(5)]) });

		await chunkedBatcher.executeBatch(calls, 400n);

		expect(mockClient.call).toHaveBeenCalledTimes(3);
	});

	it("concatenates chunked results in chunk execution order", async () => {
		const chunkedBatcher = new MulticallBatcher(mockClient, { batchSize: 2 });
		const calls = [
			makeCall({ callData: "0xaa" }),
			makeCall({ callData: "0xbb" }),
			makeCall({ callData: "0xcc" }),
		];
		vi.mocked(mockClient.call)
			.mockResolvedValueOnce({
				data: encodeResults([makeResult(10), makeResult(11)]),
			})
			.mockResolvedValueOnce({ data: encodeResults([makeResult(12)]) });

		const results = await chunkedBatcher.executeBatch(calls, 500n);

		expect(results).toEqual([makeResult(10), makeResult(11), makeResult(12)]);
	});

	it("uses custom multicall address when provided", async () => {
		const customAddress = "0x2222222222222222222222222222222222222222" as const;
		const customBatcher = new MulticallBatcher(mockClient, {
			address: customAddress,
		});

		await customBatcher.executeBatch([makeCall()], 600n);

		const callArgs = vi.mocked(mockClient.call).mock.calls[0]![0];
		expect(callArgs.to).toBe(customAddress);
	});

	it("respects custom batch size for uneven chunks", async () => {
		const chunkedBatcher = new MulticallBatcher(mockClient, { batchSize: 2 });
		const calls = [
			makeCall({ callData: "0x11" }),
			makeCall({ callData: "0x22" }),
			makeCall({ callData: "0x33" }),
		];
		vi.mocked(mockClient.call)
			.mockResolvedValueOnce({
				data: encodeResults([makeResult(1), makeResult(2)]),
			})
			.mockResolvedValueOnce({ data: encodeResults([makeResult(3)]) });

		const results = await chunkedBatcher.executeBatch(calls, 700n);

		expect(mockClient.call).toHaveBeenCalledTimes(2);
		expect(results).toHaveLength(3);
	});

	it("wraps client.call error in SELMulticallBatchError with cause", async () => {
		const rpcError = new Error("rpc failed");
		vi.mocked(mockClient.call).mockRejectedValue(rpcError);

		await expect(
			batcher.executeBatch([makeCall()], 800n),
		).rejects.toMatchObject({
			name: "SELMulticallBatchError",
			message: "Multicall3 aggregate3 call failed",
			cause: rpcError,
		});
	});

	it("throws SELMulticallBatchError when client.call returns no data", async () => {
		vi.mocked(mockClient.call).mockResolvedValue({ data: undefined });

		await expect(
			batcher.executeBatch([makeCall()], 900n),
		).rejects.toMatchObject({
			name: "SELMulticallBatchError",
			message: "Multicall3 aggregate3 returned no data",
		});
	});
});
