import { buildSchema } from "@seljs/env";
import {
	buildRoutes,
	createE2EMockClient,
	routeFor,
} from "@seljs-internal/fixtures";
import { Abi } from "ox";
import {
	HttpRequestError,
	decodeFunctionData,
	encodeAbiParameters,
} from "viem";
import { describe, expect, it, vi } from "vitest";

import { SELRuntime } from "./environment.js";
import {
	SELContractError,
	SELEvaluationError,
	SELLintError,
	SELProviderError,
} from "../errors/index.js";
import { MULTICALL3_ADDRESS } from "../execution/multicall.js";

import type { SELClient } from "./client.js";

const VAULT_ABI = Abi.from([
	"function f(uint256 x) view returns (uint256)",
	"function g() view returns (uint256)",
	"function balanceOf(address account) view returns (uint256)",
]);
const PROXY_ABI = Abi.from(["function address() view returns (address)"]);
const MULTICALL3_ABI = Abi.from([
	"function getEthBalance(address addr) view returns (uint256)",
	"function getCurrentBlockTimestamp() view returns (uint256)",
]);

const VAULT = "0x1111111111111111111111111111111111111111" as const;
const A_TOKEN = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48" as const;
const PROXY = "0x3333333333333333333333333333333333333333" as const;
const PROXY_IMPL = "0x4444444444444444444444444444444444444444" as const;

const chainSchema = (context?: Record<string, "bytes" | "sol_address">) =>
	buildSchema({
		contracts: {
			vault: { address: VAULT, abi: VAULT_ABI },
			aToken: { address: A_TOKEN, abi: VAULT_ABI },
			proxy: { address: PROXY, abi: PROXY_ABI },
		},
		context,
	});

/** Mock client routing batched and direct calls, with spies on both methods. */
const createChainClient = () => {
	const { client } = createE2EMockClient(
		buildRoutes(
			routeFor({
				abi: VAULT_ABI,
				functionName: "f",
				address: VAULT,
				result: (args: readonly unknown[]) => (args[0] as bigint) * 10n,
			}),
			routeFor({
				abi: VAULT_ABI,
				functionName: "g",
				address: VAULT,
				result: 7n,
			}),
			routeFor({
				abi: VAULT_ABI,
				functionName: "balanceOf",
				address: VAULT,
				result: 5n,
			}),
			routeFor({
				abi: PROXY_ABI,
				functionName: "address",
				address: PROXY,
				result: PROXY_IMPL,
			}),
			routeFor({
				abi: MULTICALL3_ABI,
				functionName: "getEthBalance",
				address: MULTICALL3_ADDRESS,
				result: 3n,
			}),
			routeFor({
				abi: MULTICALL3_ABI,
				functionName: "getCurrentBlockTimestamp",
				address: MULTICALL3_ADDRESS,
				result: 1700000000n,
			}),
		),
	);

	return {
		client,
		call: vi.spyOn(client, "call"),
		getBlockNumber: vi.spyOn(client, "getBlockNumber"),
	};
};

/** Mock client answering every direct call with the uint256 `1`. */
const createUintClient = () => {
	const client = {
		getBlockNumber: vi.fn().mockResolvedValue(100n),
		call: vi.fn().mockResolvedValue({
			data: encodeAbiParameters([{ type: "uint256" }], [1n]),
		}),
	};

	return { client: client as SELClient, ...client };
};

describe("src/environment/environment.ts", () => {
	describe("evaluate", () => {
		it("evaluates basic arithmetic", async () => {
			const env = new SELRuntime({ schema: buildSchema({}) });
			expect((await env.evaluate<bigint>("1 + 2")).value).toBe(3n);
		});

		it("evaluates with context variables", async () => {
			const env = new SELRuntime({
				schema: buildSchema({ context: { x: "sol_int", y: "sol_int" } }),
			});
			const result = await env.evaluate<bigint>("x + y", { x: 10n, y: 20n });
			expect(result.value).toBe(30n);
		});

		it("evaluates string expressions", async () => {
			const env = new SELRuntime({ schema: buildSchema({}) });
			expect(
				(await env.evaluate<string>('"hello" + " " + "world"')).value,
			).toBe("hello world");
		});

		it("evaluates boolean expressions", async () => {
			const env = new SELRuntime({ schema: buildSchema({}) });
			expect((await env.evaluate<boolean>("true && false")).value).toBe(false);
			expect((await env.evaluate<boolean>("true || false")).value).toBe(true);
		});
	});

	describe("uint256 type", () => {
		it("evaluates BigInt arithmetic natively", async () => {
			const env = new SELRuntime({
				schema: buildSchema({ context: { a: "sol_int", b: "sol_int" } }),
			});
			const result = await env.evaluate<bigint>("a + b", {
				a: 10n ** 18n,
				b: 10n ** 18n,
			});
			expect(result.value).toBe(2n * 10n ** 18n);
		});

		it("avoids 64-bit overflow for bigint variables", async () => {
			const env = new SELRuntime({
				schema: buildSchema({ context: { a: "sol_int", b: "sol_int" } }),
			});
			const result = await env.evaluate<bigint>("a + b", {
				a: 10n ** 21n,
				b: 10n ** 21n,
			});

			expect(result.value).toBe(2n * 10n ** 21n);
		});

		it("supports multiplication well beyond 64-bit", async () => {
			const env = new SELRuntime({
				schema: buildSchema({ context: { a: "sol_int", b: "sol_int" } }),
			});
			const result = await env.evaluate<bigint>("a * b", {
				a: 10n ** 20n,
				b: 10n ** 20n,
			});

			expect(result.value).toBe(10n ** 40n);
		});

		it("handles values larger than 2^64", async () => {
			const env = new SELRuntime({
				schema: buildSchema({ context: { balance: "sol_int" } }),
			});
			const checked = env.check("balance + balance");
			expect(checked.valid).toBe(true);
			expect(checked.type).toBe("sol_int");

			const large = 2n ** 64n + 1n;
			const envTyped = new SELRuntime({
				schema: buildSchema({ context: { a: "sol_int", b: "sol_int" } }),
			});
			expect(
				(await envTyped.evaluate<boolean>("a == b", { a: large, b: large }))
					.value,
			).toBe(true);
		});

		it("supports BigInt comparison operators", async () => {
			const env = new SELRuntime({
				schema: buildSchema({ context: { a: "sol_int", b: "sol_int" } }),
			});
			expect(
				(await env.evaluate<boolean>("a > b", { a: 100n, b: 50n })).value,
			).toBe(true);
			expect(
				(await env.evaluate<boolean>("a == b", { a: 42n, b: 42n })).value,
			).toBe(true);
		});

		it("allows registering uint256 variables for type checking", () => {
			const env = new SELRuntime({
				schema: buildSchema({ context: { balance: "sol_int" } }),
			});
			const result = env.check("balance + balance");
			expect(result).toBeDefined();
			expect(result.type).toBe("sol_int");
		});

		it("supports solInt() cast for sol_int comparisons", () => {
			const env = new SELRuntime({
				schema: buildSchema({ context: { balance: "sol_int" } }),
			});

			const result = env.check("balance > solInt(0)");
			expect(result.valid).toBe(true);
			expect(result.type).toBe("bool");
		});

		it("evaluates solInt() cast from int and string literals", async () => {
			const env = new SELRuntime({ schema: buildSchema({}) });

			expect((await env.evaluate<boolean>("solInt(1) > solInt(0)")).value).toBe(
				true,
			);
			expect(
				(await env.evaluate<boolean>('solInt("2") > solInt(1)')).value,
			).toBe(true);
		});
	});

	describe("address type", () => {
		it("compares checksummed addresses", async () => {
			const env = new SELRuntime({
				schema: buildSchema({
					context: { sender: "sol_address", owner: "sol_address" },
				}),
			});
			expect(
				(
					await env.evaluate<boolean>("sender == owner", {
						sender: "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
						owner: "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
					})
				).value,
			).toBe(true);
		});

		it("registers address type for type checking", () => {
			const env = new SELRuntime({
				schema: buildSchema({ context: { sender: "sol_address" } }),
			});
			const result = env.check("sender");
			expect(result).toBeDefined();
			expect(result.type).toBe("sol_address");
		});
	});

	describe("check", () => {
		it("returns type info for valid expressions", () => {
			const env = new SELRuntime({
				schema: buildSchema({
					context: {
						x: "sol_int",
						y: "sol_int",
					},
				}),
			});
			const result = env.check("x + y");
			expect(result).toBeDefined();
			expect(result.type).toBeDefined();
		});

		it("reports type errors for incompatible types", () => {
			const env = new SELRuntime({
				schema: buildSchema({
					context: {
						x: "sol_int",
						y: "string",
					},
				}),
			});
			const result = env.check("x + y");
			expect(result.valid).toBe(false);
		});
	});

	describe("error wrapping", () => {
		it("wraps parse errors as SELLintError with diagnostics", async () => {
			const env = new SELRuntime({ schema: buildSchema({}) });
			await expect(env.evaluate("+++")).rejects.toBeInstanceOf(SELLintError);
			await expect(env.evaluate("+++")).rejects.toSatisfy(
				(e) => (e as SELLintError).diagnostics.length > 0,
			);
		});

		it("wraps type errors for unknown variables as SELLintError with diagnostics", async () => {
			const env = new SELRuntime({ schema: buildSchema({}) });
			await expect(env.evaluate("nonexistent_var")).rejects.toBeInstanceOf(
				SELLintError,
			);
			await expect(env.evaluate("nonexistent_var")).rejects.toSatisfy(
				(e) => (e as SELLintError).diagnostics.length > 0,
			);
		});

		it("surfaces builtin length-assertion messages verbatim from hexBytes", async () => {
			const env = new SELRuntime({ schema: buildSchema({}) });
			await expect(env.evaluate('hexBytes("0x00", 32)')).rejects.toThrow(
				/hexBytes: expected 32 bytes, got 1/,
			);
			await expect(env.evaluate('hexBytes("0x00", 32)')).rejects.toBeInstanceOf(
				SELEvaluationError,
			);
		});
	});

	describe("contract errors", () => {
		const erc20Abi = Abi.from([
			"function balanceOf(address account) view returns (uint256)",
		]);
		const holder = "0x0000000000000000000000000000000000000002";
		const erc20Address = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48" as const;

		it("throws clear SELContractError when contract call has no client", async () => {
			const env = new SELRuntime({
				schema: buildSchema({
					context: { holder: "sol_address" },
					contracts: {
						erc20: {
							address: erc20Address,
							abi: erc20Abi,
						},
					},
				}),
			});

			await expect(
				env.evaluate("erc20.balanceOf(holder)", { holder }),
			).rejects.toMatchObject({
				contractName: "erc20",
				methodName: "balanceOf",
			});
			await expect(
				env.evaluate("erc20.balanceOf(holder)", { holder }),
			).rejects.toBeInstanceOf(SELContractError);
			await expect(
				env.evaluate("erc20.balanceOf(holder)", { holder }),
			).rejects.toThrow("No client provided for contract call");
		});
	});

	describe("context validation", () => {
		it("throws when context fails schema validation", async () => {
			const env = new SELRuntime({
				schema: buildSchema({ context: { balance: "sol_int" } }),
			});
			await expect(
				env.evaluate("balance > 0", { balance: "not a bigint" as any }),
			).rejects.toThrow();
		});

		it("throws when required context field is missing", async () => {
			const env = new SELRuntime({
				schema: buildSchema({ context: { balance: "sol_int" } }),
			});
			await expect(env.evaluate("balance > 0", {} as any)).rejects.toThrow();
		});

		it("silently falls back to dyn for invalid CEL type in context schema", () => {
			// With the schema-based API, unknown CEL types fall back to dyn rather than throwing at construction time
			expect(
				() =>
					new SELRuntime({
						schema: buildSchema({
							context: { x: "foobar" as "string" },
						}),
					}),
			).not.toThrow();
		});
	});

	describe("config", () => {
		it("accepts limits configuration", async () => {
			const env = new SELRuntime({
				schema: buildSchema({}),
				limits: { maxRounds: 5, maxCalls: 50 },
			});
			expect((await env.evaluate<bigint>("1 + 2")).value).toBe(3n);
		});

		it("works without config", async () => {
			const env = new SELRuntime({ schema: buildSchema({}) });
			expect((await env.evaluate<boolean>("true")).value).toBe(true);
		});
	});

	describe("parseUnits and formatUnits", () => {
		it("parseUnits scales integer by decimals", async () => {
			const env = new SELRuntime({ schema: buildSchema({}) });
			const result = await env.evaluate<bigint>("parseUnits(1000, 6)");
			expect(result.value).toBe(1000000000n);
		});

		it("parseUnits parses decimal string", async () => {
			const env = new SELRuntime({ schema: buildSchema({}) });
			const result = await env.evaluate<bigint>('parseUnits("1.5", 18)');
			expect(result.value).toBe(1500000000000000000n);
		});

		it("parseUnits with double input", async () => {
			const env = new SELRuntime({ schema: buildSchema({}) });
			const result = await env.evaluate<bigint>("parseUnits(1.5, 18)");
			expect(result.value).toBe(1500000000000000000n);
		});

		it("parseUnits with sol_int context variable", async () => {
			const env = new SELRuntime({
				schema: buildSchema({ context: { amount: "sol_int" } }),
			});
			const result = await env.evaluate<bigint>("parseUnits(amount, 6)", {
				amount: 1000n,
			});
			expect(result.value).toBe(1000000000n);
		});

		it("parseUnits compares correctly with contract-like values", async () => {
			const env = new SELRuntime({
				schema: buildSchema({ context: { balance: "sol_int" } }),
			});
			const result = await env.evaluate<boolean>(
				"balance >= parseUnits(500, 6)",
				{ balance: 1000000000n },
			);
			expect(result.value).toBe(true);
		});

		it("formatUnits scales down to double", async () => {
			const env = new SELRuntime({
				schema: buildSchema({ context: { balance: "sol_int" } }),
			});
			const result = await env.evaluate<number>("formatUnits(balance, 6)", {
				balance: 1000000000n,
			});
			expect(result.value).toBe(1000);
		});

		it("formatUnits enables readable threshold checks", async () => {
			const env = new SELRuntime({
				schema: buildSchema({ context: { balance: "sol_int" } }),
			});
			const result = await env.evaluate<boolean>(
				"formatUnits(balance, 6) >= 1000.0",
				{ balance: 1000000000n },
			);
			expect(result.value).toBe(true);
		});

		it("formatUnits with fractional result", async () => {
			const env = new SELRuntime({
				schema: buildSchema({ context: { balance: "sol_int" } }),
			});
			const result = await env.evaluate<number>("formatUnits(balance, 18)", {
				balance: 1500000000000000000n,
			});
			expect(result.value).toBe(1.5);
		});

		it("type-checks parseUnits expressions", () => {
			const env = new SELRuntime({
				schema: buildSchema({
					context: { balance: "sol_int" },
				}),
			});
			const result = env.check("balance >= parseUnits(1000, 6)");
			expect(result.valid).toBe(true);
			expect(result.type).toBe("bool");
		});

		it("type-checks formatUnits expressions", () => {
			const env = new SELRuntime({
				schema: buildSchema({
					context: { balance: "sol_int" },
				}),
			});
			const result = env.check("formatUnits(balance, 6) >= 1000.0");
			expect(result.valid).toBe(true);
			expect(result.type).toBe("bool");
		});
	});

	describe("min, max, abs, and isZeroAddress", () => {
		it("min returns the smaller value", async () => {
			const env = new SELRuntime({
				schema: buildSchema({ context: { a: "sol_int", b: "sol_int" } }),
			});
			const result = await env.evaluate<bigint>("min(a, b)", {
				a: 100n,
				b: 50n,
			});
			expect(result.value).toBe(50n);
		});

		it("max returns the larger value", async () => {
			const env = new SELRuntime({
				schema: buildSchema({ context: { a: "sol_int", b: "sol_int" } }),
			});
			const result = await env.evaluate<bigint>("max(a, b)", {
				a: 100n,
				b: 50n,
			});
			expect(result.value).toBe(100n);
		});

		it("abs returns absolute value of negative", async () => {
			const env = new SELRuntime({
				schema: buildSchema({ context: { a: "sol_int" } }),
			});
			const result = await env.evaluate<bigint>("abs(a)", { a: -42n });
			expect(result.value).toBe(42n);
		});

		it("isZeroAddress detects zero address", async () => {
			const env = new SELRuntime({
				schema: buildSchema({ context: { addr: "sol_address" } }),
			});
			const result = await env.evaluate<boolean>("isZeroAddress(addr)", {
				addr: "0x0000000000000000000000000000000000000000",
			});
			expect(result.value).toBe(true);
		});

		it("isZeroAddress returns false for non-zero", async () => {
			const env = new SELRuntime({
				schema: buildSchema({ context: { addr: "sol_address" } }),
			});
			const result = await env.evaluate<boolean>("isZeroAddress(addr)", {
				addr: "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
			});
			expect(result.value).toBe(false);
		});

		it("type-checks min expression", () => {
			const env = new SELRuntime({
				schema: buildSchema({
					context: {
						a: "sol_int",
						b: "sol_int",
					},
				}),
			});
			const result = env.check("min(a, b)");
			expect(result.valid).toBe(true);
			expect(result.type).toBe("sol_int");
		});

		it("type-checks isZeroAddress expression", () => {
			const env = new SELRuntime({
				schema: buildSchema({
					context: { owner: "sol_address" },
				}),
			});
			const result = env.check("isZeroAddress(owner)");
			expect(result.valid).toBe(true);
			expect(result.type).toBe("bool");
		});
	});

	describe("pinned live calls", () => {
		it("pins deferred calls to one block and records them in meta", async () => {
			const { client, call, getBlockNumber } = createUintClient();
			const env = new SELRuntime({ client, schema: chainSchema() });

			const result = await env.evaluate("[1, 2, 3].map(i, vault.f(i))");

			expect(getBlockNumber).toHaveBeenCalledTimes(1);
			expect(call).toHaveBeenCalledTimes(3);
			for (const [params] of call.mock.calls) {
				expect(params).toMatchObject({ blockNumber: 100n });
			}

			expect(result.meta).toEqual({
				roundsExecuted: 0,
				totalCalls: 3,
				blockNumber: 100n,
				deferredCalls: 3,
			});
		});

		it("reuses the batch block for deferred calls", async () => {
			const { client, call, getBlockNumber } = createChainClient();
			const env = new SELRuntime({ client, schema: chainSchema() });

			const result = await env.evaluate<bigint>(
				"vault.g() + [1, 2].map(i, vault.f(i)).sum()",
			);

			expect(result.value).toBe(37n);
			expect(getBlockNumber).toHaveBeenCalledTimes(1);
			for (const [params] of call.mock.calls) {
				expect(params).toMatchObject({ blockNumber: 100n });
			}

			expect(result.meta?.totalCalls).toBe(3);
			expect(result.meta?.deferredCalls).toBe(2);
		});

		it("pins deferred balance() calls", async () => {
			const { client, call } = createUintClient();
			const env = new SELRuntime({ client, schema: chainSchema() });

			await env.evaluate(
				'[solAddress("0x0000000000000000000000000000000000000001")].map(a, a.balance())',
			);

			expect(call).toHaveBeenCalledTimes(1);
			expect(call.mock.calls[0]?.[0]).toMatchObject({ blockNumber: 100n });
		});

		it.each(["[1].map(i, vault.f(i))", "vault.g()"])(
			"surfaces block number failures as provider errors: %s",
			async (expression) => {
				const { client, getBlockNumber } = createUintClient();
				getBlockNumber.mockRejectedValue(new HttpRequestError({ url: "x" }));
				const env = new SELRuntime({ client, schema: chainSchema() });

				await expect(env.evaluate(expression)).rejects.toBeInstanceOf(
					SELProviderError,
				);
			},
		);

		it("does not fetch a block for pure expressions", async () => {
			const { client, getBlockNumber } = createUintClient();
			const env = new SELRuntime({ client, schema: chainSchema() });

			const result = await env.evaluate("1 + 2");

			expect(getBlockNumber).not.toHaveBeenCalled();
			expect(result.meta).toBeUndefined();
		});
	});

	describe("builtin block", () => {
		it("reads block.timestamp in the pinned batch", async () => {
			const { client, call } = createChainClient();
			const env = new SELRuntime({ client, schema: chainSchema() });

			const result = await env.evaluate(
				"block.timestamp == solInt(1700000000)",
			);

			expect(result.value).toBe(true);
			expect(call).toHaveBeenCalledTimes(1);
			expect(call.mock.calls[0]?.[0]).toMatchObject({ blockNumber: 100n });
		});

		it("reads block.number from the pin without calls", async () => {
			const { client, call } = createChainClient();
			const env = new SELRuntime({ client, schema: chainSchema() });

			const result = await env.evaluate("block.number == solInt(100)");

			expect(result.value).toBe(true);
			expect(call).not.toHaveBeenCalled();
			expect(result.meta?.blockNumber).toBe(100n);
		});

		it("batches calls with block fields as arguments", async () => {
			const { client } = createChainClient();
			const env = new SELRuntime({ client, schema: chainSchema() });
			const context = {};

			const byNumber = await env.evaluate<bigint>(
				"vault.f(block.number)",
				context,
			);
			const byTimestamp = await env.evaluate<bigint>(
				"vault.f(block.timestamp)",
			);

			expect(byNumber.value).toBe(1000n);
			expect(byNumber.meta?.deferredCalls).toBe(0);
			expect(byTimestamp.value).toBe(17000000000n);
			expect(byTimestamp.meta?.deferredCalls).toBe(0);
			expect("block.number" in context).toBe(false);
		});

		it("binds a bare block in cel.bind", async () => {
			const { client } = createChainClient();
			const env = new SELRuntime({ client, schema: chainSchema() });

			const result = await env.evaluate(
				"cel.bind(b, block, b.timestamp > solInt(0) && b.number == solInt(100))",
			);

			expect(result.value).toBe(true);
		});

		it("is shadowed by a schema variable named block", async () => {
			const env = new SELRuntime({
				schema: buildSchema({ context: { block: "sol_int" } }),
			});

			const result = await env.evaluate("block + 1", { block: 5n });

			expect(result.value).toBe(6n);
		});

		it("wins over an undeclared block context key", async () => {
			const { client } = createChainClient();
			const env = new SELRuntime({ client, schema: chainSchema() });

			const result = await env.evaluate("block.number", { block: 999 });

			expect(result.value).toBe(100n);
		});

		it("requires a client for block.number", async () => {
			const env = new SELRuntime({ schema: chainSchema() });

			const error: unknown = await env
				.evaluate("block.number")
				.catch((e: unknown) => e);

			expect(error).toBeInstanceOf(SELContractError);
			expect((error as Error).message).toMatch(/^No client provided/);
		});
	});

	describe("contract address", () => {
		it("batches calls taking a contract address", async () => {
			const { client, call } = createChainClient();
			const env = new SELRuntime({ client, schema: chainSchema() });

			const result = await env.evaluate("vault.balanceOf(aToken.address)");

			expect(result.value).toBe(5n);
			expect(call).toHaveBeenCalledTimes(1);
			expect(result.meta?.deferredCalls).toBe(0);
		});

		it("batches a checksummed address argument once", async () => {
			const { client, call } = createChainClient();
			const env = new SELRuntime({
				client,
				schema: chainSchema({ holder: "sol_address" }),
			});

			const result = await env.evaluate<bigint>("vault.balanceOf(holder)", {
				holder: A_TOKEN,
			});

			expect(result.value).toBe(5n);
			expect(call).toHaveBeenCalledTimes(1);
			expect(result.meta?.deferredCalls).toBe(0);
		});

		it("batches balance() on a contract address", async () => {
			const { client } = createChainClient();
			const env = new SELRuntime({ client, schema: chainSchema() });

			const result = await env.evaluate("aToken.address.balance()");

			expect(result.value).toBe(3n);
			expect(result.meta?.deferredCalls).toBe(0);
		});

		it("compares a contract address without a client", async () => {
			const env = new SELRuntime({ schema: chainSchema() });

			const result = await env.evaluate(
				`aToken.address == solAddress("${A_TOKEN}")`,
			);

			expect(result.value).toBe(true);
		});

		it("keeps an ABI address() method callable next to the field", async () => {
			const { client } = createChainClient();
			const env = new SELRuntime({ client, schema: chainSchema() });

			const field = await env.evaluate(
				`proxy.address == solAddress("${PROXY}")`,
			);
			const method = await env.evaluate(
				`proxy.address() == solAddress("${PROXY_IMPL}")`,
			);

			expect(field.value).toBe(true);
			expect(method.value).toBe(true);
		});
	});

	describe("solInt(bytes)", () => {
		it("reads bytes as a big-endian unsigned integer", async () => {
			const env = new SELRuntime({ schema: buildSchema({}) });
			const max = `0x${"ff".repeat(32)}`;

			expect(
				(await env.evaluate('solInt(hexBytes("0x0100")) == solInt(256)')).value,
			).toBe(true);
			expect(
				(await env.evaluate('solInt(hexBytes("0x")) == solInt(0)')).value,
			).toBe(true);
			expect(
				(
					await env.evaluate(
						`solInt(hexBytes("${max}")) == solInt("115792089237316195423570985008687907853269984665640564039457584007913129639935")`,
					)
				).value,
			).toBe(true);
		});

		it("rejects more than 32 bytes", async () => {
			const env = new SELRuntime({ schema: buildSchema({}) });

			await expect(
				env.evaluate(`solInt(hexBytes("0x${"00".repeat(33)}"))`),
			).rejects.toBeInstanceOf(SELEvaluationError);
		});

		it("pins solInt(keccak256(...)) arguments as deferred calls", async () => {
			const { client, call } = createUintClient();
			const env = new SELRuntime({ client, schema: chainSchema() });

			const result = await env.evaluate('vault.f(solInt(keccak256("a")))');

			expect(result.meta?.deferredCalls).toBe(1);
			expect(call.mock.calls[0]?.[0]).toMatchObject({ blockNumber: 100n });
		});

		it("encodes solInt(bytes) as the uint argument", async () => {
			const { client, call } = createUintClient();
			const env = new SELRuntime({ client, schema: chainSchema() });

			await env.evaluate('vault.f(solInt(hexBytes("0x0100")))');

			const params = call.mock.calls[0]?.[0] as { data: `0x${string}` };
			const decoded = decodeFunctionData({ abi: VAULT_ABI, data: params.data });
			expect(decoded.args).toEqual([256n]);
		});

		it("defers solInt() over a bytes variable", async () => {
			const { client } = createChainClient();
			const env = new SELRuntime({
				client,
				schema: chainSchema({ data: "bytes" }),
			});

			const result = await env.evaluate<bigint>("vault.f(solInt(data))", {
				data: new Uint8Array([1, 0]),
			});

			expect(result.value).toBe(2560n);
			expect(result.meta?.deferredCalls).toBe(1);
		});

		it("batches solInt() over an int variable", async () => {
			const { client } = createChainClient();
			const schema = chainSchema();
			schema.variables.push({ name: "n", type: "int" });
			const env = new SELRuntime({ client, schema });

			const result = await env.evaluate<bigint>("vault.f(solInt(n))", {
				n: 4n,
			});

			expect(result.value).toBe(40n);
			expect(result.meta?.deferredCalls).toBe(0);
		});
	});
});
