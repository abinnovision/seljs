import { describe, expect, it } from "vitest";

import { SolidityIntTypeWrapper } from "./custom-types/index.js";
import { parseUnitsValue, formatUnitsValue } from "./units.js";

describe("src/units.ts", () => {
	describe("parseUnitsValue", () => {
		it("scales a bigint by decimals", () => {
			expect(parseUnitsValue(1000n, 6)).toEqual(
				new SolidityIntTypeWrapper(1000000000n),
			);
		});

		it("scales an integer number by decimals", () => {
			expect(parseUnitsValue(1000, 6)).toEqual(
				new SolidityIntTypeWrapper(1000000000n),
			);
		});

		it("parses a decimal string", () => {
			expect(parseUnitsValue("1.5", 18)).toEqual(
				new SolidityIntTypeWrapper(1500000000000000000n),
			);
		});

		it("parses a whole-number string", () => {
			expect(parseUnitsValue("1000", 6)).toEqual(
				new SolidityIntTypeWrapper(1000000000n),
			);
		});

		it("parses a string with trailing zeros in fraction", () => {
			expect(parseUnitsValue("1.50", 18)).toEqual(
				new SolidityIntTypeWrapper(1500000000000000000n),
			);
		});

		it("handles zero values", () => {
			expect(parseUnitsValue(0, 18)).toEqual(new SolidityIntTypeWrapper(0n));
			expect(parseUnitsValue("0", 18)).toEqual(new SolidityIntTypeWrapper(0n));
			expect(parseUnitsValue("0.0", 18)).toEqual(
				new SolidityIntTypeWrapper(0n),
			);
		});

		it("handles double input by converting to string first", () => {
			expect(parseUnitsValue(1.5, 18)).toEqual(
				new SolidityIntTypeWrapper(1500000000000000000n),
			);
		});

		it("handles SolidityIntTypeWrapper input", () => {
			const input = new SolidityIntTypeWrapper(1000n);
			expect(parseUnitsValue(input, 6)).toEqual(
				new SolidityIntTypeWrapper(1000000000n),
			);
		});

		it("throws when fractional part exceeds decimals", () => {
			expect(() => parseUnitsValue("1.1234567", 6)).toThrow("exceeds");
		});

		it("handles zero decimals with integer", () => {
			expect(parseUnitsValue(1000, 0)).toEqual(
				new SolidityIntTypeWrapper(1000n),
			);
		});

		it("throws for zero decimals with fractional string", () => {
			expect(() => parseUnitsValue("1.5", 0)).toThrow("exceeds");
		});

		it("throws for unsupported types", () => {
			expect(() => parseUnitsValue(true, 6)).toThrow("unsupported");
		});

		it("throws for invalid decimal string", () => {
			expect(() => parseUnitsValue("1.2.3", 6)).toThrow("invalid");
		});

		it("parses a negative decimal string", () => {
			expect(parseUnitsValue("-1.5", 18)).toEqual(
				new SolidityIntTypeWrapper(-1500000000000000000n),
			);
		});

		it("parses a negative whole-number string", () => {
			expect(parseUnitsValue("-1000", 6)).toEqual(
				new SolidityIntTypeWrapper(-1000000000n),
			);
		});

		it("parses a negative double input", () => {
			expect(parseUnitsValue(-1.5, 18)).toEqual(
				new SolidityIntTypeWrapper(-1500000000000000000n),
			);
		});

		it("handles negative bigint input", () => {
			expect(parseUnitsValue(-1000n, 6)).toEqual(
				new SolidityIntTypeWrapper(-1000000000n),
			);
		});
	});

	describe("formatUnitsValue", () => {
		it("formats a bigint with decimals", () => {
			expect(formatUnitsValue(1000000000n, 6)).toBe(1000);
		});

		it("formats a fractional result", () => {
			expect(formatUnitsValue(1500000000000000000n, 18)).toBe(1.5);
		});

		it("formats zero", () => {
			expect(formatUnitsValue(0n, 18)).toBe(0);
		});

		it("formats a SolidityIntTypeWrapper", () => {
			const input = new SolidityIntTypeWrapper(1000000n);
			expect(formatUnitsValue(input, 6)).toBe(1);
		});

		it("handles zero decimals", () => {
			expect(formatUnitsValue(1000n, 0)).toBe(1000);
		});
	});
});
