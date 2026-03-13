import type { TypeWrapper } from "../abstracts/index.js";

const ADDRESS_REGEX = /^0x[0-9a-fA-F]{40}$/;

/**
 * Convert a value to a valid Ethereum address string.
 *
 * @param value
 */
export const toAddress = (value: unknown): string => {
	if (value instanceof SolidityAddressTypeWrapper) {
		return value.value;
	}

	if (typeof value !== "string") {
		throw new TypeError(`Invalid address value: ${String(value)}`);
	}

	if (!SolidityAddressTypeWrapper.isValid(value)) {
		throw new TypeError(`Invalid address value: ${value}`);
	}

	return value.toLowerCase();
};

/**
 * Ethereum address wrapper with regex-based validation.
 * Normalizes to lowercase (no viem dependency).
 */
export class SolidityAddressTypeWrapper implements TypeWrapper<string> {
	public readonly value: string;

	public constructor(value: unknown) {
		this.value = toAddress(value);
	}

	/**
	 * Check whether a string is a valid 20-byte hex address.
	 */
	public static isValid(value: string): boolean {
		return ADDRESS_REGEX.test(value);
	}

	public toString(): string {
		return this.value;
	}

	public valueOf(): string {
		return this.value;
	}
}
