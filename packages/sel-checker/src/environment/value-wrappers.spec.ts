import {
	SolidityAddressTypeWrapper,
	SolidityIntTypeWrapper,
} from "@seljs/types";
import { describe, expect, it } from "vitest";

import {
	toCelLiteralType,
	wrapValueForSel,
	wrapStructValue,
} from "./value-wrappers.js";

import type { StructInfo } from "./value-wrappers.js";

describe("src/environment/value-wrappers.ts", () => {
	describe("toCelLiteralType", () => {
		it("maps SolidityInt to int", () => {
			expect(toCelLiteralType("sol_int")).toBe("int");
		});

		it("maps SolidityAddress to string", () => {
			expect(toCelLiteralType("sol_address")).toBe("string");
		});

		it("returns null for unknown types", () => {
			expect(toCelLiteralType("dyn")).toBeNull();
			expect(toCelLiteralType("bool")).toBeNull();
			expect(toCelLiteralType("bytes")).toBeNull();
			expect(toCelLiteralType("")).toBeNull();
		});
	});

	describe("wrapValueForSel", () => {
		it("wraps bigint in SolidityIntTypeWrapper", () => {
			const result = wrapValueForSel("sol_int", 42n);
			expect(result).toBeInstanceOf(SolidityIntTypeWrapper);
			expect((result as SolidityIntTypeWrapper).value).toBe(42n);
		});

		it("wraps integer number in SolidityIntTypeWrapper", () => {
			const result = wrapValueForSel("sol_int", 100);
			expect(result).toBeInstanceOf(SolidityIntTypeWrapper);
			expect((result as SolidityIntTypeWrapper).value).toBe(100n);
		});

		it("wraps address string in SolidityAddressTypeWrapper", () => {
			// valid 42-char hex
			const addr = "0xabcdef1234567890abcdef1234567890abcdef12";
			const result = wrapValueForSel("sol_address", addr);
			expect(result).toBeInstanceOf(SolidityAddressTypeWrapper);
		});

		it("passes through already-wrapped SolidityAddressTypeWrapper", () => {
			const wrapped = new SolidityAddressTypeWrapper(
				"0xabcdef1234567890abcdef1234567890abcdef12",
			);
			const result = wrapValueForSel("sol_address", wrapped);
			expect(result).toBe(wrapped);
		});

		it("passes through already-wrapped SolidityIntTypeWrapper", () => {
			const wrapped = new SolidityIntTypeWrapper(99n);
			const result = wrapValueForSel("sol_int", wrapped);
			expect(result).toBe(wrapped);
		});

		it("passes through non-integer number as-is", () => {
			const result = wrapValueForSel("dyn", 3.14);
			expect(result).toBe(3.14);
		});

		it("passes through string for non-Solidity type", () => {
			const result = wrapValueForSel("string", "hello");
			expect(result).toBe("hello");
		});

		it("passes through boolean as-is", () => {
			const result = wrapValueForSel("bool", true);
			expect(result).toBe(true);
		});
	});

	describe("wrapStructValue", () => {
		// eslint-disable-next-line @typescript-eslint/no-extraneous-class
		class PoolStruct {}
		const fieldNames = ["fee", "token0"];
		const fieldTypes: Record<string, string> = {
			fee: "sol_int",
			token0: "sol_address",
		};

		it("wraps array-based struct (multi-return)", () => {
			const registry = new Map<string, StructInfo>();
			const value = [1000n, "0xabcdef1234567890abcdef1234567890abcdef12"];
			const info: StructInfo = { ctor: PoolStruct, fieldNames, fieldTypes };
			const result = wrapStructValue(registry, info, value) as any;

			expect(result).toBeInstanceOf(PoolStruct);
			expect(result.fee).toBeInstanceOf(SolidityIntTypeWrapper);
			expect((result.fee as SolidityIntTypeWrapper).value).toBe(1000n);
			expect(result.token0).toBeInstanceOf(SolidityAddressTypeWrapper);
		});

		it("wraps object-based struct", () => {
			const registry = new Map<string, StructInfo>();
			const value = {
				fee: 500n,
				token0: "0xdeadbeef1234567890abcdef1234567890abcdef",
			};
			const info: StructInfo = { ctor: PoolStruct, fieldNames, fieldTypes };
			const result = wrapStructValue(registry, info, value) as any;

			expect(result).toBeInstanceOf(PoolStruct);
			expect(result.fee).toBeInstanceOf(SolidityIntTypeWrapper);
			expect(result.token0).toBeInstanceOf(SolidityAddressTypeWrapper);
		});

		it("recurses into nested structs via registry", () => {
			// eslint-disable-next-line @typescript-eslint/no-extraneous-class
			class InnerStruct {}
			const innerFieldNames = ["amount"];
			const innerFieldTypes: Record<string, string> = { amount: "sol_int" };

			const registry = new Map<string, StructInfo>([
				[
					"InnerStruct",
					{
						ctor: InnerStruct,
						fieldNames: innerFieldNames,
						fieldTypes: innerFieldTypes,
					},
				],
			]);

			// eslint-disable-next-line @typescript-eslint/no-extraneous-class
			class OuterStruct {}
			const outerFieldNames = ["inner", "label"];
			const outerFieldTypes: Record<string, string> = {
				inner: "InnerStruct",
				label: "string",
			};

			const value = { inner: { amount: 42n }, label: "hello" };
			const outerInfo: StructInfo = {
				ctor: OuterStruct,
				fieldNames: outerFieldNames,
				fieldTypes: outerFieldTypes,
			};
			const result = wrapStructValue(registry, outerInfo, value) as any;

			expect(result).toBeInstanceOf(OuterStruct);
			expect(result.inner).toBeInstanceOf(InnerStruct);
			expect(result.inner.amount).toBeInstanceOf(SolidityIntTypeWrapper);
			expect((result.inner.amount as SolidityIntTypeWrapper).value).toBe(42n);
			expect(result.label).toBe("hello");
		});
	});
});
