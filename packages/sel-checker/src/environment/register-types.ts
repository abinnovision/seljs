import {
	EVM_CONSTANTS,
	formatUnitsValue,
	hexToBytes,
	parseUnitsValue,
	SOLIDITY_TYPES,
	SolidityAddressTypeWrapper,
	SolidityIntTypeWrapper,
	toAddress,
	toBigInt,
} from "@seljs/types";
import { keccak256 as viemKeccak256, toBytes as viemToBytes } from "viem";

import type { Environment } from "@marcbachmann/cel-js";

/**
 * Subset of the CEL Environment API needed for Solidity type registration.
 * Mirrors the parameter signatures from Environment but drops the return type
 * to void — registerSolidityTypes never chains the return value.
 */
type SolidityTypeHost = {
	[K in
		| "registerType"
		| "registerOperator"
		| "registerFunction"
		| "registerConstant"]: (...args: Parameters<Environment[K]>) => void;
};

/**
 * Try to register an operator, silently ignoring "already registered" errors.
 * cel-js auto-derives some cross-type operators (e.g., registering
 * `sol_int == int` also creates `int == sol_int`).
 */
const tryRegisterOperator = (
	env: SolidityTypeHost,
	signature: string,
	handler: (...args: unknown[]) => unknown,
): void => {
	try {
		env.registerOperator(signature, handler);
	} catch (error) {
		if (
			!(error instanceof Error) ||
			!error.message.includes("already registered")
		) {
			throw error;
		}
	}
};

const registerAddressOperators = (env: SolidityTypeHost): void => {
	env.registerOperator(
		"sol_address == sol_address",
		(left, right) => toAddress(left) === toAddress(right),
	);

	env.registerOperator(
		"sol_address < sol_address",
		(left, right) => toAddress(left) < toAddress(right),
	);

	env.registerOperator(
		"sol_address <= sol_address",
		(left, right) => toAddress(left) <= toAddress(right),
	);

	env.registerOperator(
		"sol_address > sol_address",
		(left, right) => toAddress(left) > toAddress(right),
	);

	env.registerOperator(
		"sol_address >= sol_address",
		(left, right) => toAddress(left) >= toAddress(right),
	);
};

const toSolInt = (value: unknown): SolidityIntTypeWrapper =>
	new SolidityIntTypeWrapper(value);

const registerIntegerOperators = (env: SolidityTypeHost): void => {
	// --- sol_int <op> sol_int arithmetic ---
	env.registerOperator("sol_int + sol_int", (a, b) =>
		toSolInt(toBigInt(a) + toBigInt(b)),
	);

	env.registerOperator("sol_int - sol_int", (a, b) =>
		toSolInt(toBigInt(a) - toBigInt(b)),
	);

	env.registerOperator("sol_int * sol_int", (a, b) =>
		toSolInt(toBigInt(a) * toBigInt(b)),
	);

	env.registerOperator("sol_int / sol_int", (a, b) => {
		const divisor = toBigInt(b);
		if (divisor === 0n) {
			throw new Error("division by zero");
		}

		return toSolInt(toBigInt(a) / divisor);
	});

	env.registerOperator("sol_int % sol_int", (a, b) => {
		const divisor = toBigInt(b);
		if (divisor === 0n) {
			throw new Error("modulo by zero");
		}

		return toSolInt(toBigInt(a) % divisor);
	});

	// Unary negation
	env.registerOperator("-sol_int", (a) => toSolInt(-toBigInt(a)));

	// --- sol_int <op> sol_int comparison ---
	env.registerOperator(
		"sol_int == sol_int",
		(a, b) => toBigInt(a) === toBigInt(b),
	);

	env.registerOperator(
		"sol_int < sol_int",
		(a, b) => toBigInt(a) < toBigInt(b),
	);

	env.registerOperator(
		"sol_int <= sol_int",
		(a, b) => toBigInt(a) <= toBigInt(b),
	);

	env.registerOperator(
		"sol_int > sol_int",
		(a, b) => toBigInt(a) > toBigInt(b),
	);

	env.registerOperator(
		"sol_int >= sol_int",
		(a, b) => toBigInt(a) >= toBigInt(b),
	);

	/*
	 * --- sol_int <op> int and int <op> sol_int cross-type arithmetic ---
	 *
	 * cel-js infers a binary operator's result type from the LEFT operand by
	 * default. For "sol_int <op> int" that already gives us sol_int, matching
	 * what toSolInt() returns — no annotation needed. For the reverse order
	 * we use cel-js's explicit return-type annotation (the ": sol_int" suffix
	 * on the signature) so the wrapper is routed through the sol_int codec
	 * instead of the int codec, preventing the wrapper from leaking.
	 *
	 * Cross-type comparison operators (below) return plain booleans, so both
	 * directions are safe without any annotation.
	 */

	tryRegisterOperator(env, "sol_int + int", (a, b) =>
		toSolInt(toBigInt(a) + toBigInt(b)),
	);

	tryRegisterOperator(env, "sol_int - int", (a, b) =>
		toSolInt(toBigInt(a) - toBigInt(b)),
	);

	tryRegisterOperator(env, "sol_int * int", (a, b) =>
		toSolInt(toBigInt(a) * toBigInt(b)),
	);

	tryRegisterOperator(env, "sol_int / int", (a, b) => {
		const divisor = toBigInt(b);
		if (divisor === 0n) {
			throw new Error("division by zero");
		}

		return toSolInt(toBigInt(a) / divisor);
	});

	tryRegisterOperator(env, "sol_int % int", (a, b) => {
		const divisor = toBigInt(b);
		if (divisor === 0n) {
			throw new Error("modulo by zero");
		}

		return toSolInt(toBigInt(a) % divisor);
	});

	tryRegisterOperator(env, "int + sol_int: sol_int", (a, b) =>
		toSolInt(toBigInt(a) + toBigInt(b)),
	);

	tryRegisterOperator(env, "int - sol_int: sol_int", (a, b) =>
		toSolInt(toBigInt(a) - toBigInt(b)),
	);

	tryRegisterOperator(env, "int * sol_int: sol_int", (a, b) =>
		toSolInt(toBigInt(a) * toBigInt(b)),
	);

	tryRegisterOperator(env, "int / sol_int: sol_int", (a, b) => {
		const divisor = toBigInt(b);
		if (divisor === 0n) {
			throw new Error("division by zero");
		}

		return toSolInt(toBigInt(a) / divisor);
	});

	tryRegisterOperator(env, "int % sol_int: sol_int", (a, b) => {
		const divisor = toBigInt(b);
		if (divisor === 0n) {
			throw new Error("modulo by zero");
		}

		return toSolInt(toBigInt(a) % divisor);
	});

	// --- sol_int <op> int cross-type comparison ---
	tryRegisterOperator(
		env,
		"sol_int == int",
		(a, b) => toBigInt(a) === toBigInt(b),
	);

	tryRegisterOperator(
		env,
		"int == sol_int",
		(a, b) => toBigInt(a) === toBigInt(b),
	);

	tryRegisterOperator(
		env,
		"sol_int < int",
		(a, b) => toBigInt(a) < toBigInt(b),
	);

	tryRegisterOperator(
		env,
		"int < sol_int",
		(a, b) => toBigInt(a) < toBigInt(b),
	);

	tryRegisterOperator(
		env,
		"sol_int <= int",
		(a, b) => toBigInt(a) <= toBigInt(b),
	);

	tryRegisterOperator(
		env,
		"int <= sol_int",
		(a, b) => toBigInt(a) <= toBigInt(b),
	);

	tryRegisterOperator(
		env,
		"sol_int > int",
		(a, b) => toBigInt(a) > toBigInt(b),
	);

	tryRegisterOperator(
		env,
		"int > sol_int",
		(a, b) => toBigInt(a) > toBigInt(b),
	);

	tryRegisterOperator(
		env,
		"sol_int >= int",
		(a, b) => toBigInt(a) >= toBigInt(b),
	);

	tryRegisterOperator(
		env,
		"int >= sol_int",
		(a, b) => toBigInt(a) >= toBigInt(b),
	);
};

/**
 * Register all Solidity primitive types on a CEL Environment.
 */
export const registerSolidityTypes = (env: SolidityTypeHost): void => {
	for (const entry of SOLIDITY_TYPES) {
		/*
		 * Builtin types are handled natively by CEL and don't need registration.
		 * They are in the registry for completeness/documentation but have no wrapper class or operators.
		 */
		if (entry.type === "builtin") {
			continue;
		}

		env.registerType(entry.name, entry.wrapperClass);

		if (entry.name === "sol_address") {
			registerAddressOperators(env);
		}

		if (entry.name === "sol_int") {
			registerIntegerOperators(env);
		}

		// Register all the cast signatures for this type.
		const Ctor = entry.wrapperClass;
		for (const sig of entry.castSignatures) {
			env.registerFunction(sig, (value) => new Ctor(value));
		}
	}

	// --- Standalone helper functions ---

	/*
	 * parseUnits / formatUnits: the `decimals` argument accepts both plain `int`
	 * and `sol_int`, because `erc20.decimals()` returns `sol_int`. The runtime
	 * normalizes via `Number(toBigInt(...))` regardless of the incoming shape.
	 */

	// parseUnits: scale human-readable values to sol_int
	env.registerFunction("parseUnits(string, int): sol_int", (value, decimals) =>
		parseUnitsValue(value, Number(toBigInt(decimals))),
	);
	env.registerFunction(
		"parseUnits(string, sol_int): sol_int",
		(value, decimals) => parseUnitsValue(value, Number(toBigInt(decimals))),
	);
	env.registerFunction("parseUnits(int, int): sol_int", (value, decimals) =>
		parseUnitsValue(value, Number(toBigInt(decimals))),
	);
	env.registerFunction("parseUnits(int, sol_int): sol_int", (value, decimals) =>
		parseUnitsValue(value, Number(toBigInt(decimals))),
	);
	env.registerFunction("parseUnits(double, int): sol_int", (value, decimals) =>
		parseUnitsValue(value, Number(toBigInt(decimals))),
	);
	env.registerFunction(
		"parseUnits(double, sol_int): sol_int",
		(value, decimals) => parseUnitsValue(value, Number(toBigInt(decimals))),
	);
	env.registerFunction("parseUnits(sol_int, int): sol_int", (value, decimals) =>
		parseUnitsValue(value, Number(toBigInt(decimals))),
	);
	env.registerFunction(
		"parseUnits(sol_int, sol_int): sol_int",
		(value, decimals) => parseUnitsValue(value, Number(toBigInt(decimals))),
	);

	// formatUnits: scale sol_int down to human-readable double
	env.registerFunction("formatUnits(sol_int, int): double", (value, decimals) =>
		formatUnitsValue(value, Number(toBigInt(decimals))),
	);
	env.registerFunction(
		"formatUnits(sol_int, sol_int): double",
		(value, decimals) => formatUnitsValue(value, Number(toBigInt(decimals))),
	);
	env.registerFunction("formatUnits(int, int): double", (value, decimals) =>
		formatUnitsValue(value, Number(toBigInt(decimals))),
	);
	env.registerFunction("formatUnits(int, sol_int): double", (value, decimals) =>
		formatUnitsValue(value, Number(toBigInt(decimals))),
	);

	// min: return the smaller of two values
	env.registerFunction("min(sol_int, sol_int): sol_int", (a, b) =>
		toBigInt(a) <= toBigInt(b) ? toSolInt(a) : toSolInt(b),
	);
	env.registerFunction("min(sol_int, int): sol_int", (a, b) =>
		toBigInt(a) <= toBigInt(b) ? toSolInt(a) : toSolInt(b),
	);
	env.registerFunction("min(int, sol_int): sol_int", (a, b) =>
		toBigInt(a) <= toBigInt(b) ? toSolInt(a) : toSolInt(b),
	);
	env.registerFunction("min(int, int): sol_int", (a, b) =>
		toBigInt(a) <= toBigInt(b) ? toSolInt(a) : toSolInt(b),
	);

	// max: return the larger of two values
	env.registerFunction("max(sol_int, sol_int): sol_int", (a, b) =>
		toBigInt(a) >= toBigInt(b) ? toSolInt(a) : toSolInt(b),
	);
	env.registerFunction("max(sol_int, int): sol_int", (a, b) =>
		toBigInt(a) >= toBigInt(b) ? toSolInt(a) : toSolInt(b),
	);
	env.registerFunction("max(int, sol_int): sol_int", (a, b) =>
		toBigInt(a) >= toBigInt(b) ? toSolInt(a) : toSolInt(b),
	);
	env.registerFunction("max(int, int): sol_int", (a, b) =>
		toBigInt(a) >= toBigInt(b) ? toSolInt(a) : toSolInt(b),
	);

	// abs: return the absolute value
	env.registerFunction("abs(sol_int): sol_int", (a) => {
		const v = toBigInt(a);

		return toSolInt(v < 0n ? -v : v);
	});
	env.registerFunction("abs(int): sol_int", (a) => {
		const v = toBigInt(a);

		return toSolInt(v < 0n ? -v : v);
	});

	// isZeroAddress: check if an address is the zero address
	const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
	env.registerFunction(
		"isZeroAddress(sol_address): bool",
		(addr) => toAddress(addr) === ZERO_ADDRESS,
	);
	env.registerFunction(
		"isZeroAddress(string): bool",
		(addr) => toAddress(addr) === ZERO_ADDRESS,
	);

	// hexBytes(string): decode a 0x-prefixed hex string into a Uint8Array
	env.registerFunction("hexBytes(string): bytes", (hex) =>
		hexToBytes(hex as string),
	);

	// hexBytes(string, int): decode and assert exact byte length
	env.registerFunction("hexBytes(string, int): bytes", (hex, length) => {
		const out = hexToBytes(hex as string);
		const expected = Number(toBigInt(length));
		if (out.length !== expected) {
			throw new Error(
				`hexBytes: expected ${String(expected)} bytes, got ${String(out.length)}`,
			);
		}

		return out;
	});

	/*
	 * keccak256: pad through viem (returns `0x…` hex) then decode back to
	 * Uint8Array so every `bytes` value in the runtime is uniformly a
	 * Uint8Array. The outbound codec re-encodes to hex at call time.
	 */
	env.registerFunction("keccak256(string): bytes", (value) =>
		hexToBytes(viemKeccak256(viemToBytes(value as string))),
	);
	env.registerFunction("keccak256(bytes): bytes", (value) =>
		hexToBytes(viemKeccak256(value as Uint8Array)),
	);

	/*
	 * --- `sel.*` namespace: library-provided conveniences ---
	 *
	 * Grouped under a single `sel` identifier (e.g. `sel.WAD`, `sel.Q96`,
	 * `sel.ZERO_ADDRESS`) instead of polluting the top-level scope. Modeled
	 * as a struct type with one field per constant; the constant's runtime
	 * value is an instance carrying the pre-wrapped field values.
	 */
	// eslint-disable-next-line @typescript-eslint/no-extraneous-class
	class SelNamespace {}
	const selFields: Record<string, string> = {};
	const selValues: Record<string, unknown> = {};
	for (const constant of EVM_CONSTANTS) {
		selFields[constant.name] = constant.type;
		selValues[constant.name] =
			constant.type === "sol_int"
				? new SolidityIntTypeWrapper(constant.value)
				: new SolidityAddressTypeWrapper(constant.value);
	}

	env.registerType("SelNamespace", { ctor: SelNamespace, fields: selFields });
	env.registerConstant(
		"sel",
		"SelNamespace",
		Object.assign(new SelNamespace(), selValues),
	);
};
