import { describe, expect, it, vi } from "vitest";

import { ExecutionLimitError, SELContractError } from "../errors/index.js";

import type { CelCodecRegistry } from "@seljs/checker";
import type { ContractSchema, MethodSchema } from "@seljs/schema";
import type { PublicClient } from "viem";

const mockReadContract = vi.fn((..._args: unknown[]) =>
	Promise.resolve("mock-result" as unknown),
);
vi.mock("viem/actions", () => ({ readContract: mockReadContract }));

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

const mockClient: PublicClient = {} as unknown as PublicClient;

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

			mockReadContract.mockResolvedValueOnce("result");

			await executeContractCall(contract, method, ["0xabc"], {
				client: mockClient,
				codecRegistry,
			});

			expect(encode).toHaveBeenCalledWith("address", "0xabc");
		});

		it("uses raw args when codecRegistry is absent", async () => {
			mockReadContract.mockResolvedValueOnce("result");

			await executeContractCall(contract, method, ["0xabc"], {
				client: mockClient,
			});

			expect(mockReadContract).toHaveBeenCalledWith(
				expect.anything(),
				expect.objectContaining({ args: ["0xabc"] }),
			);
		});

		it("returns cached value on cache hit without calling client", async () => {
			const cacheKey = "erc20:balanceOf:0xabc";
			const executionCache = new Map<string, unknown>([[cacheKey, "cached"]]);
			mockReadContract.mockClear();

			const result = await executeContractCall(contract, method, ["0xabc"], {
				executionCache,
				client: mockClient,
			});

			expect(result).toBe("cached");
			expect(mockReadContract).not.toHaveBeenCalled();
		});

		it("falls through to live call on cache miss", async () => {
			const executionCache = new Map<string, unknown>();
			mockReadContract.mockResolvedValueOnce("live-result");

			const result = await executeContractCall(contract, method, ["0xabc"], {
				executionCache,
				client: mockClient,
			});

			expect(result).toBe("live-result");
			expect(mockReadContract).toHaveBeenCalled();
		});

		it("skips cache entirely when executionCache is absent", async () => {
			mockReadContract.mockResolvedValueOnce("result");

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
			mockReadContract.mockResolvedValueOnce("result");

			await executeContractCall(contract, method, ["0xabc"], {
				client: mockClient,
				callCounter,
			});

			expect(incrementSpy).toHaveBeenCalledWith("erc20", "balanceOf");
		});

		it("returns result from readContract on success", async () => {
			mockReadContract.mockResolvedValueOnce(42n);

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
			mockReadContract.mockRejectedValueOnce(selError);

			await expect(
				executeContractCall(contract, method, ["0xabc"], {
					client: mockClient,
				}),
			).rejects.toBe(selError);
		});

		it("wraps generic error in SELContractError", async () => {
			mockReadContract.mockRejectedValueOnce(new Error("rpc failed"));

			await expect(
				executeContractCall(contract, method, ["0xabc"], {
					client: mockClient,
				}),
			).rejects.toThrow(SELContractError);
		});
	});

	describe("resolveExecutionBlockNumber", () => {
		it("returns result from getBlockNumber when available", async () => {
			const client = {
				getBlockNumber: vi.fn(() => Promise.resolve(123n)),
			} as unknown as PublicClient;

			const result = await resolveExecutionBlockNumber(client);
			expect(result).toBe(123n);
		});

		it("returns undefined when client has request but no getBlockNumber", async () => {
			const client = {
				request: vi.fn(),
			} as unknown as PublicClient;

			const result = await resolveExecutionBlockNumber(client);
			expect(result).toBeUndefined();
		});

		it("returns 0n when client has neither getBlockNumber nor request", async () => {
			const result = await resolveExecutionBlockNumber(mockClient);
			expect(result).toBe(0n);
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
