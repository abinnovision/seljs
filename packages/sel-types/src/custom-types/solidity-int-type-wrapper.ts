import type { TypeWrapper } from "../abstracts/index.js";

/**
 * Convert any BigInt-compatible value to a native bigint.
 * Handles SolidityIntTypeWrapper instances, bigint literals, integer numbers, and numeric strings.
 */
export function toBigInt(value: unknown): bigint {
	if (value instanceof SolidityIntTypeWrapper) {
		return value.value;
	}

	if (typeof value === "bigint") {
		return value;
	}

	if (typeof value === "number" && Number.isInteger(value)) {
		return BigInt(value);
	}

	if (typeof value === "string") {
		return BigInt(value);
	}

	throw new TypeError(`Invalid integer value: ${String(value)}`);
}

/**
 * Unified Solidity integer wrapper for the CEL runtime.
 *
 * Wraps all Solidity integer types (uint8–uint256, int8–int256) as a single
 * CEL custom type backed by native BigInt. This bypasses cel-js's built-in
 * "int" type which enforces 64-bit overflow checks.
 */
export class SolidityIntTypeWrapper implements TypeWrapper<bigint> {
	public readonly value: bigint;

	public constructor(value: unknown) {
		this.value = toBigInt(value);
	}

	public valueOf(): bigint {
		return this.value;
	}
}
