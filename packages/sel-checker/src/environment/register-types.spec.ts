import { Environment } from "@marcbachmann/cel-js";
import {
	SolidityAddressTypeWrapper,
	SolidityIntTypeWrapper,
	toBigInt,
} from "@seljs/types";
import { describe, expect, it, vi } from "vitest";

import { registerSolidityTypes } from "./register-types.js";

function createCheckerEnv() {
	const env = new Environment();
	registerSolidityTypes(env);

	return env;
}

function createMockHost() {
	const types = new Map<string, unknown>();
	const operators = new Map<
		string,
		(left: unknown, right: unknown) => unknown
	>();

	return {
		registerType: vi.fn((name: string, ctor: unknown) => {
			types.set(name, ctor);
		}),
		registerOperator: vi.fn(
			(
				signature: string,
				operator: (left: unknown, right: unknown) => unknown,
			) => {
				operators.set(signature, operator);
			},
		),
		registerFunction: vi.fn(),

		hasType: (name: string) => types.has(name),
		hasOperator: (signature: string) => operators.has(signature),
		evaluate(signature: string, left: unknown, right: unknown) {
			const operator = operators.get(signature);
			if (!operator) {
				throw new Error(`Operator not registered: ${signature}`);
			}

			return operator(left, right);
		},
	};
}

describe("src/environment/register-types.ts", () => {
	describe("registerSolidityTypes", () => {
		it("registers address type", () => {
			const env = createMockHost();
			registerSolidityTypes(env);

			expect(env.hasType("sol_address")).toBe(true);
		});

		it("does not register uint256 or int256 types", () => {
			const env = createMockHost();
			registerSolidityTypes(env);

			expect(env.hasType("uint256")).toBe(false);
			expect(env.hasType("int256")).toBe(false);
		});

		it("registers address ordering operators", () => {
			const env = createMockHost();
			registerSolidityTypes(env);

			expect(env.hasOperator("sol_address < sol_address")).toBe(true);
			expect(env.hasOperator("sol_address <= sol_address")).toBe(true);
			expect(env.hasOperator("sol_address > sol_address")).toBe(true);
			expect(env.hasOperator("sol_address >= sol_address")).toBe(true);
		});

		it("registers address equality operator", () => {
			const env = createMockHost();
			registerSolidityTypes(env);

			expect(env.hasOperator("sol_address == sol_address")).toBe(true);
		});

		it("registers address cast function", () => {
			const env = createMockHost();
			registerSolidityTypes(env);

			expect(env.registerFunction).toHaveBeenCalledWith(
				"solAddress(string): sol_address",
				expect.any(Function),
			);
		});

		it("registers SolidityInt type", () => {
			const env = createMockHost();
			registerSolidityTypes(env);

			expect(env.hasType("sol_int")).toBe(true);
		});

		it("registers SolidityInt arithmetic operators", () => {
			const env = createMockHost();
			registerSolidityTypes(env);

			expect(env.hasOperator("sol_int + sol_int")).toBe(true);
			expect(env.hasOperator("sol_int - sol_int")).toBe(true);
			expect(env.hasOperator("sol_int * sol_int")).toBe(true);
			expect(env.hasOperator("sol_int / sol_int")).toBe(true);
			expect(env.hasOperator("sol_int % sol_int")).toBe(true);
		});

		it("registers SolidityInt comparison operators", () => {
			const env = createMockHost();
			registerSolidityTypes(env);

			expect(env.hasOperator("sol_int < sol_int")).toBe(true);
			expect(env.hasOperator("sol_int <= sol_int")).toBe(true);
			expect(env.hasOperator("sol_int > sol_int")).toBe(true);
			expect(env.hasOperator("sol_int >= sol_int")).toBe(true);
		});

		it("registers SolidityInt equality operator", () => {
			const env = createMockHost();
			registerSolidityTypes(env);

			expect(env.hasOperator("sol_int == sol_int")).toBe(true);
		});

		it("registers cross-type operators", () => {
			const env = createMockHost();
			registerSolidityTypes(env);

			// sol_int <op> int arithmetic — left operand is sol_int so result type matches
			expect(env.hasOperator("sol_int + int")).toBe(true);
			expect(env.hasOperator("sol_int - int")).toBe(true);
			expect(env.hasOperator("sol_int * int")).toBe(true);
			expect(env.hasOperator("sol_int / int")).toBe(true);
			expect(env.hasOperator("sol_int % int")).toBe(true);

			/*
			 * int <op> sol_int arithmetic is intentionally NOT registered
			 * (cel-js infers result as "int" but handler returns SolidityIntTypeWrapper)
			 */
			expect(env.hasOperator("int + sol_int")).toBe(false);
			expect(env.hasOperator("int - sol_int")).toBe(false);
			expect(env.hasOperator("int * sol_int")).toBe(false);
			expect(env.hasOperator("int / sol_int")).toBe(false);
			expect(env.hasOperator("int % sol_int")).toBe(false);

			// cross-type comparisons return bool, so both directions are safe
			expect(env.hasOperator("sol_int == int")).toBe(true);
			expect(env.hasOperator("int == sol_int")).toBe(true);
		});

		it("registers solInt cast functions", () => {
			const env = createMockHost();
			registerSolidityTypes(env);

			expect(env.registerFunction).toHaveBeenCalledWith(
				"solInt(string): sol_int",
				expect.any(Function),
			);
			expect(env.registerFunction).toHaveBeenCalledWith(
				"solInt(int): sol_int",
				expect.any(Function),
			);
		});

		it("solInt casts work in a checker environment", () => {
			const env = createCheckerEnv();
			const result42 = env.evaluate("solInt(42)", {});
			expect(toBigInt(result42)).toBe(42n);
			const result123 = env.evaluate('solInt("123")', {});
			expect(toBigInt(result123)).toBe(123n);
		});

		it("registers parseUnits function overloads", () => {
			const env = createMockHost();
			registerSolidityTypes(env);

			expect(env.registerFunction).toHaveBeenCalledWith(
				"parseUnits(string, int): sol_int",
				expect.any(Function),
			);
			expect(env.registerFunction).toHaveBeenCalledWith(
				"parseUnits(int, int): sol_int",
				expect.any(Function),
			);
			expect(env.registerFunction).toHaveBeenCalledWith(
				"parseUnits(double, int): sol_int",
				expect.any(Function),
			);
			expect(env.registerFunction).toHaveBeenCalledWith(
				"parseUnits(sol_int, int): sol_int",
				expect.any(Function),
			);
		});

		it("registers formatUnits function overloads", () => {
			const env = createMockHost();
			registerSolidityTypes(env);

			expect(env.registerFunction).toHaveBeenCalledWith(
				"formatUnits(sol_int, int): double",
				expect.any(Function),
			);
			expect(env.registerFunction).toHaveBeenCalledWith(
				"formatUnits(int, int): double",
				expect.any(Function),
			);
		});

		it("parseUnits works in a checker environment", () => {
			const env = createCheckerEnv();

			const result = env.evaluate("parseUnits(1000, 6)", {});
			expect(toBigInt(result)).toBe(1000000000n);

			const resultStr = env.evaluate('parseUnits("1.5", 18)', {});
			expect(toBigInt(resultStr)).toBe(1500000000000000000n);
		});

		it("formatUnits works in a checker environment", () => {
			const env = createCheckerEnv();
			env.registerVariable("balance", "sol_int");

			const result = env.evaluate("formatUnits(balance, 6)", {
				balance: new SolidityIntTypeWrapper(1000000000n),
			});
			expect(result).toBe(1000);
		});

		it("registers min function overloads", () => {
			const env = createMockHost();
			registerSolidityTypes(env);

			expect(env.registerFunction).toHaveBeenCalledWith(
				"min(sol_int, sol_int): sol_int",
				expect.any(Function),
			);
			expect(env.registerFunction).toHaveBeenCalledWith(
				"min(sol_int, int): sol_int",
				expect.any(Function),
			);
			expect(env.registerFunction).toHaveBeenCalledWith(
				"min(int, sol_int): sol_int",
				expect.any(Function),
			);
			expect(env.registerFunction).toHaveBeenCalledWith(
				"min(int, int): sol_int",
				expect.any(Function),
			);
		});

		it("registers max function overloads", () => {
			const env = createMockHost();
			registerSolidityTypes(env);

			expect(env.registerFunction).toHaveBeenCalledWith(
				"max(sol_int, sol_int): sol_int",
				expect.any(Function),
			);
			expect(env.registerFunction).toHaveBeenCalledWith(
				"max(sol_int, int): sol_int",
				expect.any(Function),
			);
			expect(env.registerFunction).toHaveBeenCalledWith(
				"max(int, sol_int): sol_int",
				expect.any(Function),
			);
			expect(env.registerFunction).toHaveBeenCalledWith(
				"max(int, int): sol_int",
				expect.any(Function),
			);
		});

		it("min and max work with pure int literals", () => {
			const env = createCheckerEnv();

			const minResult = env.evaluate("min(10, 20)", {});
			expect(toBigInt(minResult)).toBe(10n);

			const maxResult = env.evaluate("max(10, 20)", {});
			expect(toBigInt(maxResult)).toBe(20n);
		});

		it("min and max work in a checker environment", () => {
			const env = createCheckerEnv();
			env.registerVariable("a", "sol_int");
			env.registerVariable("b", "sol_int");

			const minResult = env.evaluate("min(a, b)", {
				a: new SolidityIntTypeWrapper(10n),
				b: new SolidityIntTypeWrapper(20n),
			});
			expect(toBigInt(minResult)).toBe(10n);

			const maxResult = env.evaluate("max(a, b)", {
				a: new SolidityIntTypeWrapper(10n),
				b: new SolidityIntTypeWrapper(20n),
			});
			expect(toBigInt(maxResult)).toBe(20n);
		});

		it("min and max work with int literals", () => {
			const env = createCheckerEnv();
			env.registerVariable("balance", "sol_int");

			const result = env.evaluate("min(balance, 100)", {
				balance: new SolidityIntTypeWrapper(500n),
			});
			expect(toBigInt(result)).toBe(100n);
		});

		it("registers abs function overloads", () => {
			const env = createMockHost();
			registerSolidityTypes(env);

			expect(env.registerFunction).toHaveBeenCalledWith(
				"abs(sol_int): sol_int",
				expect.any(Function),
			);
			expect(env.registerFunction).toHaveBeenCalledWith(
				"abs(int): sol_int",
				expect.any(Function),
			);
		});

		it("abs works in a checker environment", () => {
			const env = createCheckerEnv();

			const positive = env.evaluate("abs(solInt(-42))", {});
			expect(toBigInt(positive)).toBe(42n);

			const alreadyPositive = env.evaluate("abs(solInt(42))", {});
			expect(toBigInt(alreadyPositive)).toBe(42n);

			const zero = env.evaluate("abs(solInt(0))", {});
			expect(toBigInt(zero)).toBe(0n);
		});

		it("registers isZeroAddress function overloads", () => {
			const env = createMockHost();
			registerSolidityTypes(env);

			expect(env.registerFunction).toHaveBeenCalledWith(
				"isZeroAddress(sol_address): bool",
				expect.any(Function),
			);
			expect(env.registerFunction).toHaveBeenCalledWith(
				"isZeroAddress(string): bool",
				expect.any(Function),
			);
		});

		it("isZeroAddress detects zero address", () => {
			const env = createCheckerEnv();

			const isZero = env.evaluate(
				'isZeroAddress(solAddress("0x0000000000000000000000000000000000000000"))',
				{},
			);
			expect(isZero).toBe(true);
		});

		it("isZeroAddress returns false for non-zero address", () => {
			const env = createCheckerEnv();

			const isZero = env.evaluate(
				'isZeroAddress(solAddress("0xd8da6bf26964af9d7eed9e03e53415d37aa96045"))',
				{},
			);
			expect(isZero).toBe(false);
		});

		it("isZeroAddress works with sol_address variable", () => {
			const env = createCheckerEnv();
			env.registerVariable("owner", "sol_address");

			const result = env.evaluate("isZeroAddress(owner)", {
				owner: new SolidityAddressTypeWrapper(
					"0x0000000000000000000000000000000000000000",
				),
			});
			expect(result).toBe(true);
		});
	});

	describe("address", () => {
		it("solAddress() cast converts string to address", () => {
			const env = createCheckerEnv();
			env.registerVariable("user", "sol_address");
			const result = env.evaluate(
				'user == solAddress("0xd8da6bf26964af9d7eed9e03e53415d37aa96045")',
				{
					user: new SolidityAddressTypeWrapper(
						"0xd8da6bf26964af9d7eed9e03e53415d37aa96045",
					),
				},
			);
			expect(result).toBe(true);
		});

		it("solAddress() cast normalizes case", () => {
			const env = createCheckerEnv();
			env.registerVariable("user", "sol_address");
			const result = env.evaluate(
				'user == solAddress("0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045")',
				{
					user: new SolidityAddressTypeWrapper(
						"0xd8da6bf26964af9d7eed9e03e53415d37aa96045",
					),
				},
			);
			expect(result).toBe(true);
		});

		it("solAddress() cast rejects invalid strings", () => {
			const env = createCheckerEnv();
			expect(() => env.evaluate('solAddress("not-an-address")', {})).toThrow(
				"Invalid address value",
			);
		});

		it("supports equality", () => {
			const env = createMockHost();
			registerSolidityTypes(env);

			expect(
				env.evaluate(
					"sol_address == sol_address",
					"0xd8da6bf26964af9d7eed9e03e53415d37aa96045",
					"0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
				),
			).toBe(true);
		});

		it("address != address returns true when different", () => {
			const env = createCheckerEnv();
			env.registerVariable("a", "sol_address");
			env.registerVariable("b", "sol_address");
			const result = env.evaluate("a != b", {
				a: new SolidityAddressTypeWrapper(
					"0xd8da6bf26964af9d7eed9e03e53415d37aa96045",
				),
				b: new SolidityAddressTypeWrapper(
					"0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
				),
			});
			expect(result).toBe(true);
		});

		it("address != address returns false when equal (case-insensitive)", () => {
			const env = createCheckerEnv();
			env.registerVariable("a", "sol_address");
			env.registerVariable("b", "sol_address");
			const result = env.evaluate("a != b", {
				a: new SolidityAddressTypeWrapper(
					"0xd8da6bf26964af9d7eed9e03e53415d37aa96045",
				),
				b: new SolidityAddressTypeWrapper(
					"0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
				),
			});
			expect(result).toBe(false);
		});

		it("rejects invalid addresses", () => {
			const env = createCheckerEnv();
			expect(() => env.evaluate('solAddress("not-an-address")', {})).toThrow(
				"Invalid address value: not-an-address",
			);
		});
	});
});
