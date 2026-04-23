import {
	SolidityIntTypeWrapper,
	SOLIDITY_TYPES,
	toBigInt,
	toAddress,
	parseUnitsValue,
	formatUnitsValue,
	EVM_CONSTANTS,
} from "@seljs/types";

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
	 * --- sol_int <op> int cross-type arithmetic ---
	 *
	 * cel-js infers the result type of a binary operator from the LEFT operand.
	 * For "sol_int <op> int", the result type is "sol_int" — matching the
	 * SolidityIntTypeWrapper returned by toSolInt(). These are safe.
	 *
	 * We intentionally do NOT register "int <op> sol_int" arithmetic operators.
	 * cel-js would infer the result as "int", but the handler would return a
	 * SolidityIntTypeWrapper. The codec for "int" cannot unwrap that wrapper,
	 * causing the raw wrapper to leak into the evaluation result.
	 *
	 * Cross-type comparison operators (below) are fine — they return plain
	 * booleans regardless of operand order.
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

	// --- EVM magic constants (all sol_int) ---
	for (const { name, value } of EVM_CONSTANTS) {
		env.registerConstant(name, "sol_int", new SolidityIntTypeWrapper(value));
	}
};
