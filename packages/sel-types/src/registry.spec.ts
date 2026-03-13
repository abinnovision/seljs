import { describe, expect, it } from "vitest";

import {
	SolidityAddressTypeWrapper,
	SolidityIntTypeWrapper,
} from "./custom-types/index.js";
import { SOLIDITY_TYPES } from "./registry.js";

describe("src/registry.ts", () => {
	const findByName = (name: string) =>
		SOLIDITY_TYPES.find((t) => t.name === name);

	describe("registered types", () => {
		it.each(["bytes", "string", "bool", "sol_address", "sol_int"])(
			"has %j registered",
			(name) => {
				expect(findByName(name)).toBeDefined();
			},
		);
	});

	describe("builtins", () => {
		it.each([
			["bytes", "builtin"],
			["string", "builtin"],
			["bool", "builtin"],
		])("%j is type %j", (name, expectedType) => {
			expect(findByName(name)?.type).toBe(expectedType);
		});
	});

	describe("custom types", () => {
		it.each([
			["sol_address", SolidityAddressTypeWrapper],
			["sol_int", SolidityIntTypeWrapper],
		])("%j has wrapperClass", (name, expectedClass) => {
			const entry = findByName(name);
			expect(entry?.type).toBe("custom");
			expect((entry as { wrapperClass: unknown }).wrapperClass).toBe(
				expectedClass,
			);
		});
	});

	describe("bytes aliases", () => {
		const bytesEntry = findByName("bytes");

		it("includes dynamic bytes", () => {
			expect(bytesEntry?.solidityAliases).toContain("bytes");
		});

		it.each(["bytes1", "bytes16", "bytes32"])("includes %j", (alias) => {
			expect(bytesEntry?.solidityAliases).toContain(alias);
		});

		it("has 33 aliases (bytes + bytes1..bytes32)", () => {
			expect(bytesEntry?.solidityAliases).toHaveLength(33);
		});
	});

	describe("int aliases", () => {
		const intEntry = findByName("sol_int");

		it.each(["uint", "int", "uint8", "int8", "uint256", "int256"])(
			"includes %j",
			(alias) => {
				expect(intEntry?.solidityAliases).toContain(alias);
			},
		);

		it("has 66 aliases (uint + int + uint8..uint256 + int8..int256)", () => {
			// 2 bare aliases + 32 uint sizes + 32 int sizes = 66
			expect(intEntry?.solidityAliases).toHaveLength(66);
		});
	});

	describe("address aliases", () => {
		it("has only 'address'", () => {
			expect(findByName("sol_address")?.solidityAliases).toEqual(["address"]);
		});
	});
});
