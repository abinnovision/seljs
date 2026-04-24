import { SELTypeConversionError } from "@seljs/common";
import { describe, expect, it } from "vitest";

import {
	SolidityAddressTypeWrapper,
	SolidityIntTypeWrapper,
	toAddress,
	toBigInt,
} from "./custom-types/index.js";
import { hexToBytes } from "./hex.js";
import { parseUnitsValue } from "./units.js";

const capture = (fn: () => unknown): unknown => {
	try {
		fn();
	} catch (err) {
		return err;
	}

	return undefined;
};

describe("src/type-conversion-errors.spec.ts", () => {
	describe("sol_int (toBigInt / SolidityIntTypeWrapper)", () => {
		it("throws SELTypeConversionError for a boolean input", () => {
			const err = capture(() => toBigInt(true)) as SELTypeConversionError;
			expect(err).toBeInstanceOf(SELTypeConversionError);
			expect(err.expectedType).toBe("sol_int");
			expect(err.actualValue).toBe(true);
		});

		it("throws SELTypeConversionError via SolidityIntTypeWrapper constructor", () => {
			expect(() => new SolidityIntTypeWrapper({} as unknown)).toThrow(
				SELTypeConversionError,
			);
		});
	});

	describe("sol_address (toAddress / SolidityAddressTypeWrapper)", () => {
		it("throws SELTypeConversionError for a non-string input", () => {
			const err = capture(() => toAddress(42)) as SELTypeConversionError;
			expect(err).toBeInstanceOf(SELTypeConversionError);
			expect(err.expectedType).toBe("sol_address");
		});

		it("throws SELTypeConversionError for a malformed address string", () => {
			const err = capture(() =>
				toAddress("not-an-address"),
			) as SELTypeConversionError;
			expect(err).toBeInstanceOf(SELTypeConversionError);
			expect(err.actualValue).toBe("not-an-address");
		});

		it("throws SELTypeConversionError via SolidityAddressTypeWrapper constructor", () => {
			expect(() => new SolidityAddressTypeWrapper(123 as unknown)).toThrow(
				SELTypeConversionError,
			);
		});
	});

	describe("hexToBytes", () => {
		it("throws SELTypeConversionError for odd-length hex", () => {
			expect(() => hexToBytes("0x0")).toThrow(SELTypeConversionError);
		});

		it("throws SELTypeConversionError for invalid hex characters", () => {
			const err = capture(() => hexToBytes("0xZZ")) as SELTypeConversionError;
			expect(err).toBeInstanceOf(SELTypeConversionError);
			expect(err.expectedType).toBe("bytes");
		});
	});

	describe("parseUnitsValue", () => {
		it("throws SELTypeConversionError for invalid decimal string", () => {
			const err = capture(() =>
				parseUnitsValue("1.2.3", 6),
			) as SELTypeConversionError;
			expect(err).toBeInstanceOf(SELTypeConversionError);
			expect(err.expectedType).toBe("sol_int");
			expect(err.actualValue).toBe("1.2.3");
		});

		it("throws SELTypeConversionError when fractional exceeds decimals", () => {
			expect(() => parseUnitsValue("1.1234567", 6)).toThrow(
				SELTypeConversionError,
			);
		});

		it("throws SELTypeConversionError for unsupported value types", () => {
			expect(() => parseUnitsValue(true, 6)).toThrow(SELTypeConversionError);
		});
	});
});
