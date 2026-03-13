import { SOLIDITY_TYPES } from "./registry.js";

import type { AbiType } from "abitype";

const LIST_REGEX = /^(.*)(\[\d*\])$/;

/**
 * Checks if a Solidity type string represents a list type (e.g. "uint256[]", "address[5]") and extracts the base type.
 *
 * @param input Solidity type string to check (e.g. "uint256[]", "address[5]", "bool")
 * @return The base type string if the input is a list type (e.g. "uint256" for "uint256[]"), or null if the input is not a list type
 */
const tryListMatch = (input: string): string | null => {
	const match = input.match(LIST_REGEX);
	if (match) {
		return match[1] ?? null;
	}

	return null;
};

/**
 * Maps a raw Solidity type string to its corresponding CEL type.
 *
 * @param input The raw Solidity type string (e.g. "uint256", "address", "bool")
 * @return The corresponding CEL type name, or null if the type is not recognized
 */
export const mapSolidityTypeToCEL = (input: string): string | null => {
	// First check if the input type represents a list type.
	const listBaseType = tryListMatch(input);

	if (listBaseType) {
		// Make a recursive call into this function to resolve the base type of the list.
		const celBaseType = mapSolidityTypeToCEL(listBaseType);
		if (celBaseType) {
			return `list<${celBaseType}>`;
		}
	} else {
		// Go through the registry and check all the aliases for each registered type to see if any of them match the input type string.
		const aliasedType = SOLIDITY_TYPES.find((type) =>
			(type.solidityAliases as AbiType[]).includes(input as AbiType),
		);

		if (aliasedType) {
			return aliasedType.name;
		}
	}

	// Return null if there is no match.
	return null;
};

/**
 * Checks if a given Solidity type string represents a list type (e.g. "uint256[]", "address[5]").
 * @param input
 */
export const isSolidityTypeList = (input: string): boolean => {
	return tryListMatch(input) !== null;
};
