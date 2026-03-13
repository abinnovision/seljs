import {
	type Abi,
	type Address,
	encodeFunctionData,
	encodeFunctionResult,
	type Hex,
	type PublicClient,
} from "viem";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ResultCache } from "./result-cache.js";
import { RoundExecutor } from "./round-executor.js";
import { MulticallBatchError } from "../errors/index.js";

import type { MulticallBatcher } from "./multicall-batcher.js";
import type { MulticallResult } from "./multicall.js";
import type { ExecutionContext } from "./types.js";
import type { CollectedCall, ExecutionRound } from "../analysis/types.js";

const TEST_ABI: Abi = [
	{
		type: "function",
		name: "balanceOf",
		inputs: [{ name: "owner", type: "address" }],
		outputs: [{ name: "", type: "uint256" }],
		stateMutability: "view",
	},
];

const TEST_ADDRESS: Address = "0x1111111111111111111111111111111111111111";

function makeCall(overrides: Partial<CollectedCall> = {}): CollectedCall {
	return {
		id: "token:balanceOf:user",
		contract: "token",
		method: "balanceOf",
		args: [
			{
				type: "literal",
				value: "0x0000000000000000000000000000000000000abc",
			},
		],
		astNode: {},
		...overrides,
	};
}

function makeRound(calls: CollectedCall[], roundNumber = 0): ExecutionRound {
	return { roundNumber, calls };
}

function makeContext(
	overrides: Partial<ExecutionContext> = {},
): ExecutionContext {
	return {
		client: {} as unknown as PublicClient,
		blockNumber: 100n,
		variables: {},
		...overrides,
	};
}

function makeReturnData(value: bigint): Hex {
	return encodeFunctionResult({
		abi: TEST_ABI,
		functionName: "balanceOf",
		result: value,
	});
}

function makeMockBatcher(results: MulticallResult[]): {
	batcher: MulticallBatcher;
	executeBatch: ReturnType<typeof vi.fn>;
} {
	const executeBatch = vi.fn(() => Promise.resolve(results));

	return {
		batcher: { executeBatch } as unknown as MulticallBatcher,
		executeBatch,
	};
}

describe("src/execution/round-executor.ts", () => {
	let cache: ResultCache;
	let contractMap: Map<string, { abi: Abi; address: Address }>;
	let executor: RoundExecutor;
	let executeBatch: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		cache = new ResultCache();
		contractMap = new Map([
			["token", { abi: TEST_ABI, address: TEST_ADDRESS }],
		]);
		const mockBatcher = makeMockBatcher([
			{ success: true, returnData: makeReturnData(42n) },
		]);
		executeBatch = mockBatcher.executeBatch;
		executor = new RoundExecutor(contractMap, cache, mockBatcher.batcher);
	});

	it("executes calls with correct blockNumber", async () => {
		const call = makeCall({
			args: [{ type: "variable", variableName: "user" }],
		});
		const round = makeRound([call]);
		const ctx = makeContext({
			blockNumber: 100n,
			variables: { user: "0x0000000000000000000000000000000000000abc" },
		});

		await executor.executeRound(round, ctx);

		expect(executeBatch).toHaveBeenCalledTimes(1);
		expect(executeBatch.mock.calls[0]?.[1]).toBe(100n);
	});

	it("resolves variable arguments from context", async () => {
		const user = "0x0000000000000000000000000000000000000abc";
		const call = makeCall({
			args: [{ type: "variable", variableName: "user" }],
		});
		const round = makeRound([call]);

		await executor.executeRound(round, makeContext({ variables: { user } }));

		expect(executeBatch.mock.calls[0]?.[0]).toEqual([
			{
				target: TEST_ADDRESS,
				allowFailure: false,
				callData: encodeFunctionData({
					abi: TEST_ABI,
					functionName: "balanceOf",
					args: [user],
				}),
			},
		]);
	});

	it("resolves literal arguments", async () => {
		const owner = "0x0000000000000000000000000000000000001234";
		const call = makeCall({ args: [{ type: "literal", value: owner }] });

		await executor.executeRound(makeRound([call]), makeContext());

		expect(executeBatch.mock.calls[0]?.[0]).toEqual([
			{
				target: TEST_ADDRESS,
				allowFailure: false,
				callData: encodeFunctionData({
					abi: TEST_ABI,
					functionName: "balanceOf",
					args: [owner],
				}),
			},
		]);
	});

	it("resolves call_result arguments from cache", async () => {
		const owner = "0x0000000000000000000000000000000000000def";
		cache.set("staking:stakedOwner:user", owner);

		const call = makeCall({
			id: "token:balanceOf:staking:stakedOwner:user",
			args: [
				{ type: "call_result", dependsOnCallId: "staking:stakedOwner:user" },
			],
		});

		await executor.executeRound(makeRound([call]), makeContext());

		expect(executeBatch.mock.calls[0]?.[0]).toEqual([
			{
				target: TEST_ADDRESS,
				allowFailure: false,
				callData: encodeFunctionData({
					abi: TEST_ABI,
					functionName: "balanceOf",
					args: [owner],
				}),
			},
		]);
	});

	it("stores decoded results in cache after execution", async () => {
		const call = makeCall();

		await executor.executeRound(makeRound([call]), makeContext());

		expect(cache.has(call.id)).toBe(true);
		expect(cache.get(call.id)).toBe(42n);
	});

	it("executes multiple calls in a single batch", async () => {
		const call1 = makeCall({ id: "token:balanceOf:user1" });
		const call2 = makeCall({ id: "token:balanceOf:user2" });

		executeBatch.mockResolvedValue([
			{ success: true, returnData: makeReturnData(11n) },
			{ success: true, returnData: makeReturnData(22n) },
		]);

		await executor.executeRound(makeRound([call1, call2]), makeContext());

		expect(executeBatch).toHaveBeenCalledTimes(1);
		expect((executeBatch.mock.calls[0]![0] as unknown[]).length).toBe(2);
		expect(cache.get(call1.id)).toBe(11n);
		expect(cache.get(call2.id)).toBe(22n);
	});

	it("throws when contract is not registered", async () => {
		const call = makeCall({ contract: "unknown" });

		await expect(
			executor.executeRound(makeRound([call]), makeContext()),
		).rejects.toThrow("Failed to encode call");
	});

	it("includes failed call metadata when encoding fails", async () => {
		const call = makeCall({ args: [] });

		await expect(
			executor.executeRound(makeRound([call]), makeContext()),
		).rejects.toBeInstanceOf(MulticallBatchError);
		await expect(
			executor.executeRound(makeRound([call]), makeContext()),
		).rejects.toMatchObject({
			message: "Failed to encode call",
			failedCallIndex: 0,
			contractName: "token",
			methodName: "balanceOf",
		});
	});

	it("throws MulticallBatchError when call fails", async () => {
		const call = makeCall();
		executeBatch.mockResolvedValue([
			{ success: false, returnData: "0x" as Hex },
		]);

		await expect(
			executor.executeRound(makeRound([call]), makeContext()),
		).rejects.toBeInstanceOf(MulticallBatchError);
		await expect(
			executor.executeRound(makeRound([call]), makeContext()),
		).rejects.toMatchObject({
			message: "Call failed: token.balanceOf",
			failedCallIndex: 0,
			contractName: "token",
			methodName: "balanceOf",
		});
	});
});
