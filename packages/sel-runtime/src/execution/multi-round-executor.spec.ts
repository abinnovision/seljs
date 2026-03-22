import { type Abi, AbiFunction } from "ox";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { multicall3Function } from "./multicall.js";

import type {
	CollectedCall,
	ExecutionPlan,
	ExecutionRound,
} from "../analysis/types.js";
import type { SELClient } from "../environment/client.js";

const { MultiRoundExecutor } = await import("./multi-round-executor.js");

const TEST_ABI: Abi.Abi = [
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

const TEST_ADDRESS: `0x${string}` =
	"0x1111111111111111111111111111111111111111";

function makeEncodedCallResponse(value: bigint, functionName = "readOne") {
	return AbiFunction.encodeResult(TEST_ABI, functionName, [value]);
}

function makeClientCallResponse(
	results: { value: bigint; functionName?: string }[],
) {
	const encoded = results.map(({ value, functionName = "readOne" }) => ({
		success: true,
		returnData: makeEncodedCallResponse(value, functionName),
	}));

	return { data: AbiFunction.encodeResult(multicall3Function, encoded as any) };
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
	let mockClient: SELClient;

	beforeEach(() => {
		mockClient = {
			call: vi.fn().mockResolvedValue(makeClientCallResponse([{ value: 42n }])),
			getBlockNumber: vi.fn().mockResolvedValue(999n),
		};

		executor = new MultiRoundExecutor(
			mockClient,
			new Map([["token", { abi: TEST_ABI, address: TEST_ADDRESS }]]),
		);
	});

	it("executes single round plan", async () => {
		const call = makeCall({ id: "token:readOne:single" });
		const plan = makePlan([makeRound([call], 0)]);

		const result = await executor.execute(plan, {}, 123n);

		expect(mockClient.call).toHaveBeenCalledTimes(1);
		expect(vi.mocked(mockClient.call).mock.calls[0]![0]).toMatchObject({
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

		vi.mocked(mockClient.call)
			.mockResolvedValueOnce(makeClientCallResponse([{ value: 5n }]))
			.mockResolvedValueOnce(
				makeClientCallResponse([{ value: 8n, functionName: "readTwo" }]),
			);

		const plan = makePlan([makeRound([callA], 0), makeRound([callB], 1)]);

		await executor.execute(plan, {}, 456n);

		expect(mockClient.call).toHaveBeenCalledTimes(2);
		const secondCallData = (
			vi.mocked(mockClient.call).mock.calls[1]![0] as { data: `0x${string}` }
		).data;
		const decoded = AbiFunction.decodeData(multicall3Function, secondCallData);
		const batchCalls = (
			decoded as readonly [readonly { callData: `0x${string}` }[]]
		)[0];
		expect(batchCalls[0]?.callData).toBe(
			AbiFunction.encodeData(TEST_ABI, "readTwo", [5n]),
		);
	});

	it("locks blockNumber at start", async () => {
		const call1 = makeCall({ id: "token:readOne:1" });
		const call2 = makeCall({
			id: "token:readOne:2",
			method: "readTwo",
			args: [{ type: "literal", value: 2n }],
		});

		vi.mocked(mockClient.call)
			.mockResolvedValueOnce(makeClientCallResponse([{ value: 42n }]))
			.mockResolvedValueOnce(
				makeClientCallResponse([{ value: 42n, functionName: "readTwo" }]),
			);

		const plan = makePlan([makeRound([call1], 0), makeRound([call2], 1)]);

		await executor.execute(plan);

		expect(mockClient.getBlockNumber).toHaveBeenCalledTimes(1);
		expect(vi.mocked(mockClient.call).mock.calls[0]![0]).toMatchObject({
			blockNumber: 999n,
		});
		expect(vi.mocked(mockClient.call).mock.calls[1]![0]).toMatchObject({
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

		vi.mocked(mockClient.call)
			.mockResolvedValueOnce(
				makeClientCallResponse([
					{ value: 42n },
					{ value: 42n, functionName: "readTwo" },
				]),
			)
			.mockResolvedValueOnce(
				makeClientCallResponse([{ value: 42n, functionName: "readThree" }]),
			);

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

		vi.mocked(mockClient.call).mockResolvedValueOnce(
			makeClientCallResponse([
				{ value: 42n },
				{ value: 42n, functionName: "readTwo" },
			]),
		);

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
