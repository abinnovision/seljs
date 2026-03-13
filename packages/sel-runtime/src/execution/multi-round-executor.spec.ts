import {
	type Abi,
	type Address,
	encodeFunctionData,
	encodeFunctionResult,
	type PublicClient,
} from "viem";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type {
	CollectedCall,
	ExecutionPlan,
	ExecutionRound,
} from "../analysis/types.js";

const mockReadContract = vi.fn((..._args: unknown[]) =>
	Promise.resolve([] as { success: boolean; returnData: `0x${string}` }[]),
);
const mockGetBlockNumber = vi.fn(() => Promise.resolve(999n));

vi.mock("viem/actions", () => ({
	readContract: mockReadContract,
	getBlockNumber: mockGetBlockNumber,
}));

const { MultiRoundExecutor } = await import("./multi-round-executor.js");

const TEST_ABI: Abi = [
	{
		type: "function",
		name: "readOne",
		inputs: [],
		outputs: [{ name: "", type: "uint256" }],
		stateMutability: "view",
	},
	{
		type: "function",
		name: "readTwo",
		inputs: [{ name: "value", type: "uint256" }],
		outputs: [{ name: "", type: "uint256" }],
		stateMutability: "view",
	},
	{
		type: "function",
		name: "readThree",
		inputs: [],
		outputs: [{ name: "", type: "uint256" }],
		stateMutability: "view",
	},
];

const TEST_ADDRESS: Address = "0x1111111111111111111111111111111111111111";

function makeAggregateResult(value: bigint) {
	return {
		success: true,
		returnData: encodeFunctionResult({
			abi: TEST_ABI,
			functionName: "readOne",
			result: value,
		}),
	};
}

function makeCall(overrides: Partial<CollectedCall> = {}): CollectedCall {
	return {
		id: "token:readOne:[]",
		contract: "token",
		method: "readOne",
		args: [],
		astNode: {},
		...overrides,
	};
}

function makeRound(
	calls: CollectedCall[],
	roundNumber: number,
): ExecutionRound {
	return { roundNumber, calls };
}

function makePlan(rounds: ExecutionRound[]): ExecutionPlan {
	return {
		rounds,
		totalCalls: rounds.reduce((count, round) => count + round.calls.length, 0),
		maxDepth: rounds.length,
	};
}

describe("src/execution/multi-round-executor.ts", () => {
	let executor: InstanceType<typeof MultiRoundExecutor>;

	beforeEach(() => {
		mockReadContract.mockClear();
		mockGetBlockNumber.mockClear();
		mockGetBlockNumber.mockResolvedValue(999n);
		mockReadContract.mockImplementation((...args: unknown[]) => {
			const params = args[1] as { args?: readonly [readonly unknown[]] };
			const batchCalls = params.args?.[0] ?? [];

			return Promise.resolve(batchCalls.map(() => makeAggregateResult(42n)));
		});

		executor = new MultiRoundExecutor(
			{} as unknown as PublicClient,
			new Map([["token", { abi: TEST_ABI, address: TEST_ADDRESS }]]),
		);
	});

	it("executes single round plan", async () => {
		const call = makeCall({ id: "token:readOne:single" });
		const plan = makePlan([makeRound([call], 0)]);

		const result = await executor.execute(plan, {}, 123n);

		expect(mockReadContract).toHaveBeenCalledTimes(1);
		expect((mockReadContract.mock.calls[0] as unknown[])[1]).toMatchObject({
			functionName: "aggregate3",
			blockNumber: 123n,
		});
		expect(result.results.get(call.id)).toBe(42n);
	});

	it("executes multi-round plan in sequence", async () => {
		const callA = makeCall({ id: "token:readOne:A", method: "readOne" });
		const callB = makeCall({
			id: "token:readTwo:B",
			method: "readTwo",
			args: [{ type: "call_result", dependsOnCallId: callA.id }],
		});

		mockReadContract
			.mockResolvedValueOnce([makeAggregateResult(5n)])
			.mockResolvedValueOnce([makeAggregateResult(8n)]);

		const plan = makePlan([makeRound([callA], 0), makeRound([callB], 1)]);

		await executor.execute(plan, {}, 456n);

		expect(mockReadContract).toHaveBeenCalledTimes(2);
		const secondCallParams = (
			mockReadContract.mock.calls[1] as unknown[]
		)[1] as {
			args: readonly [readonly { callData: string }[]];
		};
		expect(secondCallParams.args[0][0]?.callData).toBe(
			encodeFunctionData({
				abi: TEST_ABI,
				functionName: "readTwo",
				args: [5n],
			}),
		);
	});

	it("locks blockNumber at start", async () => {
		const call1 = makeCall({ id: "token:readOne:1" });
		const call2 = makeCall({
			id: "token:readOne:2",
			method: "readTwo",
			args: [{ type: "literal", value: 2n }],
		});
		const plan = makePlan([makeRound([call1], 0), makeRound([call2], 1)]);

		await executor.execute(plan);

		expect(mockGetBlockNumber).toHaveBeenCalledTimes(1);
		expect((mockReadContract.mock.calls[0] as unknown[])[1]).toMatchObject({
			blockNumber: 999n,
		});
		expect((mockReadContract.mock.calls[1] as unknown[])[1]).toMatchObject({
			blockNumber: 999n,
		});
	});

	it("returns correct ExecutionResult with metadata", async () => {
		const round1CallA = makeCall({ id: "token:readOne:A" });
		const round1CallB = makeCall({
			id: "token:readOne:B",
			method: "readTwo",
			args: [{ type: "literal", value: 3n }],
		});
		const round2Call = makeCall({ id: "token:readOne:C", method: "readThree" });
		const plan = makePlan([
			makeRound([round1CallA, round1CallB], 0),
			makeRound([round2Call], 1),
		]);

		const result = await executor.execute(plan);

		expect(result.meta.roundsExecuted).toBe(2);
		expect(result.meta.totalCalls).toBe(3);
		expect(result.meta.blockNumber).toBe(999n);
	});

	it("returns all call results in results map", async () => {
		const call1 = makeCall({ id: "token:readOne:one" });
		const call2 = makeCall({
			id: "token:readOne:two",
			method: "readTwo",
			args: [{ type: "literal", value: 7n }],
		});
		const plan = makePlan([makeRound([call1, call2], 0)]);

		const result = await executor.execute(plan, {}, 777n);

		expect(result.results.has(call1.id)).toBe(true);
		expect(result.results.has(call2.id)).toBe(true);
	});

	it("empty plan returns empty result", async () => {
		const plan = makePlan([]);

		const result = await executor.execute(plan, {}, 101n);

		expect(result.results.size).toBe(0);
		expect(result.meta.roundsExecuted).toBe(0);
	});
});
