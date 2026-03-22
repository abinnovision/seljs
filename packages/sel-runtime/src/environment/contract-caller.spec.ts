import { describe, expect, it, vi } from "vitest";

import { ExecutionLimitError, SELContractError } from "../errors/index.js";

import type { SELClient } from "./client.js";
import type { CelCodecRegistry } from "@seljs/checker";
import type { ContractSchema, MethodSchema } from "@seljs/schema";

const mockEncodeData = vi.fn().mockReturnValue("0xencoded");
const mockDecodeResult = vi.fn().mockReturnValue("mock-result");

vi.mock("ox", async (importOriginal) => {
	// eslint-disable-next-line @typescript-eslint/consistent-type-imports
	const actual = await importOriginal<typeof import("ox")>();

	return {
		...actual,
		AbiFunction: {
			...actual.AbiFunction,
			encodeData: mockEncodeData,
			decodeResult: mockDecodeResult,
		},
	};
});

const {
	CallCounter,
	executeContractCall,
	resolveExecutionBlockNumber,
	buildContractInfoMap,
} = await import("./contract-caller.js");

const makeContract = (
	name = "erc20",
	address = "0x1234" as const,
): ContractSchema =>
	({
		name,
		address,
		methods: [],
	}) as unknown as ContractSchema;

const makeMethod = (name = "balanceOf", paramType = "address"): MethodSchema =>
	({
		name,
		params: [{ name: "owner", type: paramType }],
		abi: { type: "function", name, inputs: [], outputs: [] },
		returns: "uint256",
	}) as unknown as MethodSchema;

const mockClient: SELClient = {
	call: vi.fn().mockResolvedValue({ data: "0x00" }),
	getBlockNumber: vi.fn().mockResolvedValue(100n),
};

describe("src/environment/contract-caller.ts", () => {
	describe("callCounter", () => {
		it("increment stays within limit", () => {
			const counter = new CallCounter(5);
			expect(() => {
				counter.increment("erc20", "balanceOf");
			}).not.toThrow();
		});

		it("increment throws ExecutionLimitError when exceeding maxCalls", () => {
			const counter = new CallCounter(2);
			counter.increment("erc20", "balanceOf");
			counter.increment("erc20", "balanceOf");
			expect(() => {
				counter.increment("erc20", "balanceOf");
			}).toThrow(ExecutionLimitError);
		});

		it("defaults initialCount to 0", () => {
			const counter = new CallCounter(1);
			expect(() => {
				counter.increment("erc20", "balanceOf");
			}).not.toThrow();
			expect(() => {
				counter.increment("erc20", "balanceOf");
			}).toThrow(ExecutionLimitError);
		});

		it("carries pre-executed count via initialCount", () => {
			const counter = new CallCounter(6, 5);
			expect(() => {
				counter.increment("erc20", "balanceOf");
			}).not.toThrow();
			expect(() => {
				counter.increment("erc20", "balanceOf");
			}).toThrow(ExecutionLimitError);
		});
	});

	describe("executeContractCall", () => {
		const contract = makeContract();
		const method = makeMethod();

		it("encodes args via codecRegistry when present", async () => {
			const encode = vi.fn((_type: string, val: unknown) => val);
			const codecRegistry = { encode } as unknown as CelCodecRegistry;

			mockDecodeResult.mockReturnValueOnce("result");
			vi.mocked(mockClient.call).mockResolvedValueOnce({ data: "0xresult" });

			await executeContractCall(contract, method, ["0xabc"], {
				client: mockClient,
				codecRegistry,
			});

			expect(encode).toHaveBeenCalledWith("address", "0xabc");
		});

		it("uses raw args when codecRegistry is absent", async () => {
			mockEncodeData.mockReturnValueOnce("0xencoded");
			vi.mocked(mockClient.call).mockResolvedValueOnce({ data: "0xresult" });
			mockDecodeResult.mockReturnValueOnce("result");

			await executeContractCall(contract, method, ["0xabc"], {
				client: mockClient,
			});

			expect(mockEncodeData).toHaveBeenCalledWith([method.abi], method.name, [
				"0xabc",
			]);
		});

		it("returns cached value on cache hit without calling client", async () => {
			const cacheKey = "erc20:balanceOf:0xabc";
			const executionCache = new Map<string, unknown>([[cacheKey, "cached"]]);
			vi.mocked(mockClient.call).mockClear();

			const result = await executeContractCall(contract, method, ["0xabc"], {
				executionCache,
				client: mockClient,
			});

			expect(result).toBe("cached");
			expect(mockClient.call).not.toHaveBeenCalled();
		});

		it("falls through to live call on cache miss", async () => {
			const executionCache = new Map<string, unknown>();
			vi.mocked(mockClient.call).mockResolvedValueOnce({ data: "0xresult" });
			mockDecodeResult.mockReturnValueOnce("live-result");

			const result = await executeContractCall(contract, method, ["0xabc"], {
				executionCache,
				client: mockClient,
			});

			expect(result).toBe("live-result");
			expect(mockClient.call).toHaveBeenCalled();
		});

		it("skips cache entirely when executionCache is absent", async () => {
			vi.mocked(mockClient.call).mockResolvedValueOnce({ data: "0xresult" });
			mockDecodeResult.mockReturnValueOnce("result");

			const result = await executeContractCall(contract, method, ["0xabc"], {
				client: mockClient,
			});

			expect(result).toBe("result");
		});

		it("throws SELContractError when client is absent", async () => {
			await expect(
				executeContractCall(contract, method, ["0xabc"], {}),
			).rejects.toThrow(SELContractError);
		});

		it("calls callCounter.increment when present", async () => {
			const callCounter = new CallCounter(100);
			const incrementSpy = vi.spyOn(callCounter, "increment");
			vi.mocked(mockClient.call).mockResolvedValueOnce({ data: "0xresult" });
			mockDecodeResult.mockReturnValueOnce("result");

			await executeContractCall(contract, method, ["0xabc"], {
				client: mockClient,
				callCounter,
			});

			expect(incrementSpy).toHaveBeenCalledWith("erc20", "balanceOf");
		});

		it("returns result from client.call on success", async () => {
			vi.mocked(mockClient.call).mockResolvedValueOnce({ data: "0xresult" });
			mockDecodeResult.mockReturnValueOnce(42n);

			const result = await executeContractCall(contract, method, ["0xabc"], {
				client: mockClient,
			});

			expect(result).toBe(42n);
		});

		it("re-throws SELContractError as-is", async () => {
			const selError = new SELContractError("already sel", {
				contractName: "erc20",
				methodName: "balanceOf",
			});
			vi.mocked(mockClient.call).mockRejectedValueOnce(selError);

			await expect(
				executeContractCall(contract, method, ["0xabc"], {
					client: mockClient,
				}),
			).rejects.toBe(selError);
		});

		it("wraps generic error in SELContractError", async () => {
			vi.mocked(mockClient.call).mockRejectedValueOnce(new Error("rpc failed"));

			await expect(
				executeContractCall(contract, method, ["0xabc"], {
					client: mockClient,
				}),
			).rejects.toThrow(SELContractError);
		});

		it("throws SELContractError when call returns no data", async () => {
			vi.mocked(mockClient.call).mockResolvedValueOnce({ data: undefined });

			await expect(
				executeContractCall(contract, method, ["0xabc"], {
					client: mockClient,
				}),
			).rejects.toThrow(SELContractError);
		});
	});

	describe("resolveExecutionBlockNumber", () => {
		it("returns block number from client.getBlockNumber()", async () => {
			const client: SELClient = {
				call: vi.fn().mockResolvedValue({ data: "0x00" }),
				getBlockNumber: vi.fn().mockResolvedValue(123n),
			};

			const result = await resolveExecutionBlockNumber(client);
			expect(result).toBe(123n);
		});
	});

	describe("buildContractInfoMap", () => {
		it("maps contract array to Map<string, ContractInfo>", () => {
			const contracts = [
				{
					name: "erc20",
					address: "0x1234" as const,
					methods: [
						{ abi: { type: "function", name: "balanceOf" } },
						{ abi: { type: "function", name: "transfer" } },
					],
				},
				{
					name: "vault",
					address: "0x5678" as const,
					methods: [{ abi: { type: "function", name: "deposit" } }],
				},
			] as unknown as ContractSchema[];

			const map = buildContractInfoMap(contracts);

			expect(map.size).toBe(2);
			expect(map.get("erc20")).toEqual({
				abi: [
					{ type: "function", name: "balanceOf" },
					{ type: "function", name: "transfer" },
				],
				address: "0x1234",
			});
			expect(map.get("vault")).toEqual({
				abi: [{ type: "function", name: "deposit" }],
				address: "0x5678",
			});
		});

		it("returns empty map for empty array", () => {
			const map = buildContractInfoMap([]);
			expect(map.size).toBe(0);
		});
	});
});
