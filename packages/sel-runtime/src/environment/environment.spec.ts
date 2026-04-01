import { buildSchema } from "@seljs/env";
import { Abi } from "ox";
import { describe, expect, it } from "vitest";

import { SELRuntime } from "./environment.js";
import { SELContractError, SELLintError } from "../errors/index.js";

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
});
