import { beforeEach, describe, expect, it, vi } from "vitest";

import type { MulticallCall } from "./multicall.js";
import type { Address, PublicClient } from "viem";

interface DecodedMulticallResult {
	success: boolean;
	returnData: `0x${string}`;
}

const mockReadContract = vi.fn<
	() => Promise<readonly DecodedMulticallResult[]>
>(() =>
	Promise.resolve([
		{
			success: true,
			returnData:
				"0x0000000000000000000000000000000000000000000000000000000000000001",
		},
	]),
);
vi.mock("viem/actions", () => ({ readContract: mockReadContract }));
const { MulticallBatcher } = await import("./multicall-batcher.js");

function makeCall(overrides: Partial<MulticallCall> = {}): MulticallCall {
	return {
		target: "0x1111111111111111111111111111111111111111",
		allowFailure: false,
		callData: "0x70a08231",
		...overrides,
	};
}

function makeResult(seed: number) {
	return {
		success: true,
		returnData: `0x${seed.toString(16).padStart(64, "0")}` as const,
	};
}

describe("src/execution/multicall-batcher.ts", () => {
	let batcher: InstanceType<typeof MulticallBatcher>;

	beforeEach(() => {
		mockReadContract.mockClear();
		mockReadContract.mockResolvedValue([makeResult(1)]);
		batcher = new MulticallBatcher({} as unknown as PublicClient);
	});

	it("returns empty array for empty calls without readContract", async () => {
		const results = await batcher.executeBatch([], 100n);

		expect(results).toEqual([]);
		expect(mockReadContract).not.toHaveBeenCalled();
	});

	it("executes single call using aggregate3 and blockNumber", async () => {
		const call = makeCall();
		const expectedResult = makeResult(7);
		mockReadContract.mockResolvedValue([expectedResult]);

		const results = await batcher.executeBatch([call], 200n);

		expect(mockReadContract).toHaveBeenCalledTimes(1);
		expect((mockReadContract.mock.calls[0] as unknown[])[1]).toMatchObject({
			functionName: "aggregate3",
			args: [[call]],
			blockNumber: 200n,
		});
		expect(results).toEqual([expectedResult]);
	});

	it("batches multiple calls within batchSize into single aggregate3 request", async () => {
		const calls = [makeCall(), makeCall({ callData: "0x1234" })];
		mockReadContract.mockResolvedValue([makeResult(1), makeResult(2)]);

		const results = await batcher.executeBatch(calls, 300n);

		expect(mockReadContract).toHaveBeenCalledTimes(1);
		expect((mockReadContract.mock.calls[0] as unknown[])[1]).toMatchObject({
			args: [calls],
			blockNumber: 300n,
		});
		expect(results).toHaveLength(2);
	});

	it("chunks calls exceeding batchSize into multiple aggregate3 requests", async () => {
		batcher = new MulticallBatcher({} as unknown as PublicClient, {
			batchSize: 2,
		});
		const calls = [
			makeCall({ callData: "0x01" }),
			makeCall({ callData: "0x02" }),
			makeCall({ callData: "0x03" }),
			makeCall({ callData: "0x04" }),
			makeCall({ callData: "0x05" }),
		];

		mockReadContract
			.mockResolvedValueOnce([makeResult(1), makeResult(2)])
			.mockResolvedValueOnce([makeResult(3), makeResult(4)])
			.mockResolvedValueOnce([makeResult(5)]);

		await batcher.executeBatch(calls, 400n);

		expect(mockReadContract).toHaveBeenCalledTimes(3);
		expect((mockReadContract.mock.calls[0] as unknown[])[1]).toMatchObject({
			args: [calls.slice(0, 2)],
		});
		expect((mockReadContract.mock.calls[1] as unknown[])[1]).toMatchObject({
			args: [calls.slice(2, 4)],
		});
		expect((mockReadContract.mock.calls[2] as unknown[])[1]).toMatchObject({
			args: [calls.slice(4, 5)],
		});
	});

	it("concatenates chunked results in chunk execution order", async () => {
		batcher = new MulticallBatcher({} as unknown as PublicClient, {
			batchSize: 2,
		});
		const calls = [
			makeCall({ callData: "0xaa" }),
			makeCall({ callData: "0xbb" }),
			makeCall({ callData: "0xcc" }),
		];
		mockReadContract
			.mockResolvedValueOnce([makeResult(10), makeResult(11)])
			.mockResolvedValueOnce([makeResult(12)]);

		const results = await batcher.executeBatch(calls, 500n);

		expect(results).toEqual([makeResult(10), makeResult(11), makeResult(12)]);
	});

	it("uses custom multicall address when provided", async () => {
		const customAddress: Address = "0x2222222222222222222222222222222222222222";
		batcher = new MulticallBatcher({} as unknown as PublicClient, {
			address: customAddress,
		});

		await batcher.executeBatch([makeCall()], 600n);

		expect((mockReadContract.mock.calls[0] as unknown[])[1]).toMatchObject({
			address: customAddress,
		});
	});

	it("respects custom batch size for uneven chunks", async () => {
		batcher = new MulticallBatcher({} as unknown as PublicClient, {
			batchSize: 2,
		});
		const calls = [
			makeCall({ callData: "0x11" }),
			makeCall({ callData: "0x22" }),
			makeCall({ callData: "0x33" }),
		];
		mockReadContract
			.mockResolvedValueOnce([makeResult(1), makeResult(2)])
			.mockResolvedValueOnce([makeResult(3)]);

		const results = await batcher.executeBatch(calls, 700n);

		expect(mockReadContract).toHaveBeenCalledTimes(2);
		expect(results).toHaveLength(3);
	});

	it("wraps readContract error in MulticallBatchError with cause", async () => {
		const rpcError = new Error("rpc failed");
		mockReadContract.mockRejectedValue(rpcError);

		await expect(
			batcher.executeBatch([makeCall()], 800n),
		).rejects.toMatchObject({
			name: "MulticallBatchError",
			message: "Multicall3 aggregate3 call failed",
			cause: rpcError,
		});
	});
});
