import {
	SolidityAddressTypeWrapper,
	SolidityIntTypeWrapper,
} from "./custom-types/index.js";

import type { TypeWrapper } from "./abstracts/index.js";
import type { AbiType, SolidityBytes, SolidityInt } from "abitype";

/**
 * Unified representation of Solidity type identity in the CEL environment.
 */
type SolidityTypeIdentity = {
	name: string;
	solidityAliases: readonly AbiType[];
} & (
	| { type: "builtin" }
	| {
			type: "custom";
			schema: { kind: "primitive"; description: string };
			wrapperClass: new (value: unknown) => TypeWrapper<unknown>;
			castSignatures: readonly string[];
	  }
);

/**
 * Generates the list of Solidity bytes type aliases (bytes, bytes1, ..., bytes32).
 */
const generateBytesAliases = (): SolidityBytes[] => {
	const aliases: SolidityBytes[] = ["bytes"];

	// Generate bytes1 to bytes32 aliases.
	for (let size = 1; size <= 32; size++) {
		aliases.push(`bytes${String(size)}` as SolidityBytes);
	}

	return aliases;
};

/**
 * Generates the list of Solidity int/uint type aliases (int, uint, int8, uint8, ..., int256, uint256).
 */
const generateIntAliases = (): AbiType[] => {
	const aliases: SolidityInt[] = ["uint", "int"];

	// Generate uint8 to uint256 aliases (including "uint" as alias for "uint256").
	for (let size = 8; size <= 256; size += 8) {
		aliases.push(`uint${String(size)}` as SolidityInt);
	}

	// Generate int8 to int256 aliases (including "int" as alias for "int256").
	for (let size = 8; size <= 256; size += 8) {
		aliases.push(`int${String(size)}` as SolidityInt);
	}

	return aliases;
};

/**
 * The single source of truth for Solidity type identity in the CEL environment.
 * Keyed by CEL type name.
 */
export const SOLIDITY_TYPES = [
	/*
	 * - Byte types: bytes, bytes1-bytes32 → "bytes"
	 * This maps all byte array types to a single "bytes" CEL type.
	 */
	{ type: "builtin", name: "bytes", solidityAliases: generateBytesAliases() },
	{ type: "builtin", name: "string", solidityAliases: ["string"] },
	{ type: "builtin", name: "bool", solidityAliases: ["bool"] },

	// - Address type: address → "sol_address"
	{
		type: "custom",
		name: "sol_address",
		solidityAliases: ["address"],
		wrapperClass: SolidityAddressTypeWrapper,
		schema: { kind: "primitive", description: "20-byte Ethereum address" },
		castSignatures: ["solAddress(string): sol_address"],
	},

	// - Integer types: sol_int
	{
		type: "custom",
		name: "sol_int",
		solidityAliases: generateIntAliases(),
		wrapperClass: SolidityIntTypeWrapper,
		schema: { kind: "primitive", description: "Arbitrary-size integer" },
		castSignatures: ["solInt(string): sol_int", "solInt(int): sol_int"],
	},
] satisfies SolidityTypeIdentity[] as SolidityTypeIdentity[];
