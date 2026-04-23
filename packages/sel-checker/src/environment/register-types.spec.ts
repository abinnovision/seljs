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
	const constants = new Map<string, { type: string; value: unknown }>();

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
		registerConstant: vi.fn((name: string, type: string, value: unknown) => {
			constants.set(name, { type, value });
		}),

		hasType: (name: string) => types.has(name),
		hasOperator: (signature: string) => operators.has(signature),
		hasConstant: (name: string) => constants.has(name),
		getConstant: (name: string) => constants.get(name),
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

			/*
			 * sol_int <op> int arithmetic — left operand is sol_int so result type
			 * is inferred as sol_int without annotation
			 */
			expect(env.hasOperator("sol_int + int")).toBe(true);
			expect(env.hasOperator("sol_int - int")).toBe(true);
			expect(env.hasOperator("sol_int * int")).toBe(true);
			expect(env.hasOperator("sol_int / int")).toBe(true);
			expect(env.hasOperator("sol_int % int")).toBe(true);

			/*
			 * int <op> sol_int arithmetic — registered with an explicit
			 * ": sol_int" return-type annotation so cel-js routes the wrapper
			 * through the sol_int codec instead of defaulting to int
			 */
			expect(env.hasOperator("int + sol_int: sol_int")).toBe(true);
			expect(env.hasOperator("int - sol_int: sol_int")).toBe(true);
			expect(env.hasOperator("int * sol_int: sol_int")).toBe(true);
			expect(env.hasOperator("int / sol_int: sol_int")).toBe(true);
			expect(env.hasOperator("int % sol_int: sol_int")).toBe(true);

			// cross-type comparisons return bool, so both directions are safe
			expect(env.hasOperator("sol_int == int")).toBe(true);
			expect(env.hasOperator("int == sol_int")).toBe(true);
		});

		it("int <op> sol_int arithmetic evaluates to sol_int", () => {
			const env = createCheckerEnv();

			expect(toBigInt(env.evaluate("2 + solInt(10)", {}))).toBe(12n);
			expect(toBigInt(env.evaluate("100 - solInt(1)", {}))).toBe(99n);
			expect(toBigInt(env.evaluate("2 * solInt(10)", {}))).toBe(20n);
			expect(toBigInt(env.evaluate("100 / solInt(4)", {}))).toBe(25n);
			expect(toBigInt(env.evaluate("10 % solInt(3)", {}))).toBe(1n);
		});

		it("int / sol_int throws on division by zero", () => {
			const env = createCheckerEnv();
			expect(() => env.evaluate("100 / solInt(0)", {})).toThrow(
				"division by zero",
			);
		});

		it("int % sol_int throws on modulo by zero", () => {
			const env = createCheckerEnv();
			expect(() => env.evaluate("100 % solInt(0)", {})).toThrow(
				"modulo by zero",
			);
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

		it("registers list<sol_int> reducer functions", () => {
			const env = createMockHost();
			registerSolidityTypes(env);

			expect(env.registerFunction).toHaveBeenCalledWith(
				"list<sol_int>.sum(): sol_int",
				expect.any(Function),
			);
			expect(env.registerFunction).toHaveBeenCalledWith(
				"list<sol_int>.min(): sol_int",
				expect.any(Function),
			);
			expect(env.registerFunction).toHaveBeenCalledWith(
				"list<sol_int>.max(): sol_int",
				expect.any(Function),
			);
		});

		it("list<sol_int>.sum() adds all elements", () => {
			const env = createCheckerEnv();
			env.registerVariable("nums", "list<sol_int>");

			const result = env.evaluate("nums.sum()", {
				nums: [
					new SolidityIntTypeWrapper(1n),
					new SolidityIntTypeWrapper(2n),
					new SolidityIntTypeWrapper(3n),
				],
			});
			expect(toBigInt(result)).toBe(6n);
		});

		it("list<sol_int>.sum() returns 0 for an empty list", () => {
			const env = createCheckerEnv();
			env.registerVariable("nums", "list<sol_int>");

			const result = env.evaluate("nums.sum()", { nums: [] });
			expect(toBigInt(result)).toBe(0n);
		});

		it("list<sol_int>.min() returns the smallest element", () => {
			const env = createCheckerEnv();
			env.registerVariable("nums", "list<sol_int>");

			const result = env.evaluate("nums.min()", {
				nums: [
					new SolidityIntTypeWrapper(5n),
					new SolidityIntTypeWrapper(2n),
					new SolidityIntTypeWrapper(9n),
				],
			});
			expect(toBigInt(result)).toBe(2n);
		});

		it("list<sol_int>.max() returns the largest element", () => {
			const env = createCheckerEnv();
			env.registerVariable("nums", "list<sol_int>");

			const result = env.evaluate("nums.max()", {
				nums: [
					new SolidityIntTypeWrapper(5n),
					new SolidityIntTypeWrapper(2n),
					new SolidityIntTypeWrapper(9n),
				],
			});
			expect(toBigInt(result)).toBe(9n);
		});

		it("list<sol_int>.min() throws on empty list", () => {
			const env = createCheckerEnv();
			env.registerVariable("nums", "list<sol_int>");

			expect(() => env.evaluate("nums.min()", { nums: [] })).toThrow(
				"list is empty",
			);
		});

		it("list<sol_int>.max() throws on empty list", () => {
			const env = createCheckerEnv();
			env.registerVariable("nums", "list<sol_int>");

			expect(() => env.evaluate("nums.max()", { nums: [] })).toThrow(
				"list is empty",
			);
		});

		it("list<sol_int> reducers handle single-element lists", () => {
			const env = createCheckerEnv();
			env.registerVariable("nums", "list<sol_int>");

			const ctx = { nums: [new SolidityIntTypeWrapper(42n)] };
			expect(toBigInt(env.evaluate("nums.sum()", ctx))).toBe(42n);
			expect(toBigInt(env.evaluate("nums.min()", ctx))).toBe(42n);
			expect(toBigInt(env.evaluate("nums.max()", ctx))).toBe(42n);
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

	describe("parseUnits / formatUnits sol_int decimals", () => {
		it("registers sol_int decimals overloads for parseUnits", () => {
			const env = createMockHost();
			registerSolidityTypes(env);

			for (const signature of [
				"parseUnits(string, sol_int): sol_int",
				"parseUnits(int, sol_int): sol_int",
				"parseUnits(double, sol_int): sol_int",
				"parseUnits(sol_int, sol_int): sol_int",
			]) {
				expect(env.registerFunction).toHaveBeenCalledWith(
					signature,
					expect.any(Function),
				);
			}
		});

		it("registers sol_int decimals overloads for formatUnits", () => {
			const env = createMockHost();
			registerSolidityTypes(env);

			for (const signature of [
				"formatUnits(sol_int, sol_int): double",
				"formatUnits(int, sol_int): double",
			]) {
				expect(env.registerFunction).toHaveBeenCalledWith(
					signature,
					expect.any(Function),
				);
			}
		});

		it("formatUnits accepts sol_int for decimals", () => {
			const env = createCheckerEnv();
			const result = env.evaluate(
				"formatUnits(solInt(1500000), solInt(6))",
				{},
			);
			expect(result).toBe(1.5);
		});

		it("parseUnits accepts sol_int for decimals", () => {
			const env = createCheckerEnv();
			const result = env.evaluate('parseUnits("1.5", solInt(6))', {});
			expect(toBigInt(result)).toBe(1500000n);
		});
	});

	describe("sel namespace", () => {
		it("registers SelNamespace as a struct type with one field per constant", () => {
			const env = createMockHost();
			registerSolidityTypes(env);

			expect(env.hasType("SelNamespace")).toBe(true);
		});

		it("registers `sel` as a SelNamespace-typed constant", () => {
			const env = createMockHost();
			registerSolidityTypes(env);

			expect(env.hasConstant("sel")).toBe(true);
			expect(env.getConstant("sel")?.type).toBe("SelNamespace");
		});

		it("sel.WAD evaluates to 10^18", () => {
			const env = createCheckerEnv();
			const result = env.evaluate("sel.WAD", {});
			expect(toBigInt(result)).toBe(10n ** 18n);
		});

		it("sel.RAY evaluates to 10^27", () => {
			const env = createCheckerEnv();
			const result = env.evaluate("sel.RAY", {});
			expect(toBigInt(result)).toBe(10n ** 27n);
		});

		it("sel.Q96 evaluates to 2^96", () => {
			const env = createCheckerEnv();
			const result = env.evaluate("sel.Q96", {});
			expect(toBigInt(result)).toBe(1n << 96n);
		});

		it("sel.Q128 evaluates to 2^128", () => {
			const env = createCheckerEnv();
			const result = env.evaluate("sel.Q128", {});
			expect(toBigInt(result)).toBe(1n << 128n);
		});

		it("sel.MAX_UINT256 evaluates to 2^256 - 1", () => {
			const env = createCheckerEnv();
			const result = env.evaluate("sel.MAX_UINT256", {});
			expect(toBigInt(result)).toBe(2n ** 256n - 1n);
		});

		it("sel.ZERO_ADDRESS evaluates to the null address", () => {
			const env = createCheckerEnv();
			const result = env.evaluate("sel.ZERO_ADDRESS", {});
			expect(result).toBeInstanceOf(SolidityAddressTypeWrapper);
			expect((result as SolidityAddressTypeWrapper).value).toBe(
				"0x0000000000000000000000000000000000000000",
			);
		});

		it("sel.ZERO_BYTES32 evaluates to 32 zero bytes", () => {
			const env = createCheckerEnv();
			const result = env.evaluate("sel.ZERO_BYTES32", {});
			expect(result).toBeInstanceOf(Uint8Array);
			expect((result as Uint8Array).length).toBe(32);
			expect((result as Uint8Array).every((b) => b === 0)).toBe(true);
		});

		it("sel.ZERO_BYTES32 composes with keccak256 (ENS root → eth hash)", () => {
			const env = createCheckerEnv();
			// namehash("eth") = keccak256(sel.ZERO_BYTES32 + keccak256("eth"))
			const result = env.evaluate(
				'keccak256(sel.ZERO_BYTES32 + keccak256("eth"))',
				{},
			);
			const hex =
				"0x" +
				Array.from(result as Uint8Array)
					.map((b) => b.toString(16).padStart(2, "0"))
					.join("");
			expect(hex).toBe(
				"0x93cdeb708b7545dc668eb9280176169d1c33cfd8ed6f04690a0bcc88a93fc4ae",
			);
		});

		it("sel.* constants participate in sol_int arithmetic", () => {
			const env = createCheckerEnv();
			const result = env.evaluate("sel.WAD + solInt(1)", {});
			expect(toBigInt(result)).toBe(10n ** 18n + 1n);
		});
	});

	describe("hexBytes", () => {
		it("registers hexBytes function overloads", () => {
			const env = createMockHost();
			registerSolidityTypes(env);

			expect(env.registerFunction).toHaveBeenCalledWith(
				"hexBytes(string): bytes",
				expect.any(Function),
			);
			expect(env.registerFunction).toHaveBeenCalledWith(
				"hexBytes(string, int): bytes",
				expect.any(Function),
			);
		});

		it("decodes a 0x-prefixed hex string", () => {
			const env = createCheckerEnv();
			const result = env.evaluate('hexBytes("0xdeadbeef")', {});
			expect(result).toBeInstanceOf(Uint8Array);
			expect(Array.from(result as Uint8Array)).toEqual([
				0xde, 0xad, 0xbe, 0xef,
			]);
		});

		it("decodes a hex string without 0x prefix", () => {
			const env = createCheckerEnv();
			const result = env.evaluate('hexBytes("deadbeef")', {});
			expect(Array.from(result as Uint8Array)).toEqual([
				0xde, 0xad, 0xbe, 0xef,
			]);
		});

		it("rejects non-hex characters", () => {
			const env = createCheckerEnv();
			expect(() => env.evaluate('hexBytes("0xZZ")', {})).toThrow(
				/invalid hex character/,
			);
		});

		it("rejects odd-length hex strings", () => {
			const env = createCheckerEnv();
			expect(() => env.evaluate('hexBytes("0x0")', {})).toThrow(/even-length/);
		});

		it("length-asserted overload accepts matching length", () => {
			const env = createCheckerEnv();
			const hex = "0x" + "00".repeat(32);
			const result = env.evaluate(`hexBytes("${hex}", 32)`, {});
			expect((result as Uint8Array).length).toBe(32);
		});

		it("length-asserted overload rejects length mismatch", () => {
			const env = createCheckerEnv();
			expect(() => env.evaluate('hexBytes("0x00", 32)', {})).toThrow(
				/expected 32 bytes, got 1/,
			);
		});

		it("length-asserted overload works for bytes4 selector shape", () => {
			const env = createCheckerEnv();
			const result = env.evaluate('hexBytes("0x12345678", 4)', {});
			expect(Array.from(result as Uint8Array)).toEqual([
				0x12, 0x34, 0x56, 0x78,
			]);
		});
	});

	describe("keccak256", () => {
		it("registers keccak256 function overloads", () => {
			const env = createMockHost();
			registerSolidityTypes(env);

			expect(env.registerFunction).toHaveBeenCalledWith(
				"keccak256(string): bytes",
				expect.any(Function),
			);
			expect(env.registerFunction).toHaveBeenCalledWith(
				"keccak256(bytes): bytes",
				expect.any(Function),
			);
		});

		it("hashes a UTF-8 string to the canonical MINTER_ROLE value", () => {
			const env = createCheckerEnv();
			const result = env.evaluate('keccak256("MINTER_ROLE")', {});
			// Precomputed: keccak256(utf8("MINTER_ROLE"))
			const expected =
				"0x9f2df0fed2c77648de5860a4cc508cd0818c85b8b8a1ab4ceeef8d981c8956a6";
			expect(result).toBeInstanceOf(Uint8Array);
			const hex =
				"0x" +
				Array.from(result as Uint8Array)
					.map((b) => b.toString(16).padStart(2, "0"))
					.join("");
			expect(hex).toBe(expected);
		});

		it("hashes an empty bytes value to the empty-input keccak256", () => {
			const env = createCheckerEnv();
			const result = env.evaluate('keccak256(hexBytes("0x"))', {});
			const hex =
				"0x" +
				Array.from(result as Uint8Array)
					.map((b) => b.toString(16).padStart(2, "0"))
					.join("");
			expect(hex).toBe(
				"0xc5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470",
			);
		});

		it("keccak256 result has length 32", () => {
			const env = createCheckerEnv();
			const result = env.evaluate('keccak256("anything")', {});
			expect((result as Uint8Array).length).toBe(32);
		});
	});
});
