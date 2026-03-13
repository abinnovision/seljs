import { describe, expect, it } from "vitest";

import { isSolidityTypeList, mapSolidityTypeToCEL } from "./conversion.js";

describe("src/conversion.ts", () => {
	describe("mapSolidityTypeToCEL", () => {
		it.each([
			// Integer types
			["uint256", "sol_int"],
			["uint8", "sol_int"],
			["uint128", "sol_int"],
			["uint", "sol_int"],
			["int256", "sol_int"],
			["int8", "sol_int"],
			["int", "sol_int"],

			// Address
			["address", "sol_address"],

			// Builtins
			["bool", "bool"],
			["string", "string"],

			// Bytes
			["bytes", "bytes"],
			["bytes1", "bytes"],
			["bytes20", "bytes"],
			["bytes32", "bytes"],

			// Arrays
			["uint256[]", "list<sol_int>"],
			["address[]", "list<sol_address>"],
			["bool[]", "list<bool>"],
			["uint256[5]", "list<sol_int>"],
			["bytes32[]", "list<bytes>"],
			["uint256[][]", "list<list<sol_int>>"],

			// Unrecognized / not sel-types concern
			["tuple", null],
			["unknown", null],
			["", null],
			["uint512", null],
			["bytes33", null],
		])("maps %j → %j", (input, expected) => {
			expect(mapSolidityTypeToCEL(input)).toBe(expected);
		});
	});

	describe("isSolidityTypeList", () => {
		it.each([
			["uint256[]", true],
			["uint256[5]", true],
			["uint256[][]", true],
			["uint256", false],
			["address", false],
			["tuple", false],
		])("isSolidityTypeList(%j) → %j", (input, expected) => {
			expect(isSolidityTypeList(input)).toBe(expected);
		});
	});
});
