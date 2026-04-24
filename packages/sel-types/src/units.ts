import { SELTypeConversionError } from "@seljs/common";

import { SolidityIntTypeWrapper, toBigInt } from "./custom-types/index.js";

const parseDecimalString = (
	value: string,
	decimals: number,
	scale: bigint,
): SolidityIntTypeWrapper => {
	const negative = value.startsWith("-");
	const abs = negative ? value.slice(1) : value;

	const parts = abs.split(".");

	if (parts.length > 2) {
		throw new SELTypeConversionError(
			`parseUnits: invalid decimal string: "${value}"`,
			{ expectedType: "sol_int", actualValue: value },
		);
	}

	const wholePart = parts[0] ?? "0";
	const fracPart = parts[1] ?? "";

	if (fracPart.length > decimals) {
		throw new SELTypeConversionError(
			`parseUnits: fractional part "${fracPart}" exceeds ${String(decimals)} decimals`,
			{ expectedType: "sol_int", actualValue: value },
		);
	}

	const whole = BigInt(wholePart) * scale;
	const frac =
		fracPart.length > 0 ? BigInt(fracPart.padEnd(decimals, "0")) : 0n;

	const result = whole + frac;

	return new SolidityIntTypeWrapper(negative ? -result : result);
};

/**
 * Parse a human-readable value into a scaled sol_int.
 * Mirrors viem/ethers parseUnits behavior.
 *
 * Accepts: bigint, number (int or float), string (decimal notation), SolidityIntTypeWrapper.
 * Floats are converted to string first to avoid floating-point math.
 */
export const parseUnitsValue = (
	value: unknown,
	decimals: number,
): SolidityIntTypeWrapper => {
	const scale = 10n ** BigInt(decimals);

	if (value instanceof SolidityIntTypeWrapper) {
		return new SolidityIntTypeWrapper(value.value * scale);
	}

	if (typeof value === "bigint") {
		return new SolidityIntTypeWrapper(value * scale);
	}

	if (typeof value === "number") {
		if (Number.isInteger(value)) {
			return new SolidityIntTypeWrapper(BigInt(value) * scale);
		}

		return parseUnitsValue(String(value), decimals);
	}

	if (typeof value === "string") {
		return parseDecimalString(value, decimals, scale);
	}

	throw new SELTypeConversionError(
		`parseUnits: unsupported value type: ${typeof value}`,
		{ expectedType: "sol_int", actualValue: value },
	);
};

/**
 * Format a sol_int value into a human-readable double.
 * Mirrors viem/ethers formatUnits behavior.
 */
export const formatUnitsValue = (value: unknown, decimals: number): number => {
	const raw = toBigInt(value);
	const scale = 10n ** BigInt(decimals);
	const whole = raw / scale;
	const remainder = raw % scale;

	return Number(whole) + Number(remainder) / Number(scale);
};
