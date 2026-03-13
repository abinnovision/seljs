import { describe, expect, it } from "vitest";

import {
	expectedTypeForOperator,
	isTypeCompatible,
} from "./type-compatibility.js";

describe("src/checker/type-compatibility.ts", () => {
	describe("expectedTypeForOperator", () => {
		it("returns bool for logical operators regardless of left type", () => {
			expect(expectedTypeForOperator("int", "&&")).toBe("bool");
			expect(expectedTypeForOperator("string", "||")).toBe("bool");
			expect(expectedTypeForOperator("bool", "&&")).toBe("bool");
		});

		it("returns same numeric type for arithmetic operators", () => {
			expect(expectedTypeForOperator("int", "+")).toBe("int");
			expect(expectedTypeForOperator("int", "-")).toBe("int");
			expect(expectedTypeForOperator("int", "*")).toBe("int");
			expect(expectedTypeForOperator("double", "/")).toBe("double");
			expect(expectedTypeForOperator("int", "%")).toBe("int");
		});

		it("returns undefined for non-arithmetic types with arithmetic operators", () => {
			expect(expectedTypeForOperator("bool", "+")).toBeUndefined();
			expect(expectedTypeForOperator("sol_address", "*")).toBeUndefined();
			expect(expectedTypeForOperator("string", "-")).toBeUndefined();
		});

		it("returns same type for concatenation types with + operator", () => {
			expect(expectedTypeForOperator("string", "+")).toBe("string");
			expect(expectedTypeForOperator("list", "+")).toBe("list");
			expect(expectedTypeForOperator("bytes", "+")).toBe("bytes");
		});

		it("returns undefined for concatenation types with non-+ arithmetic operators", () => {
			expect(expectedTypeForOperator("string", "-")).toBeUndefined();
			expect(expectedTypeForOperator("list", "*")).toBeUndefined();
			expect(expectedTypeForOperator("bytes", "/")).toBeUndefined();
		});

		it("returns same type for comparison operators on comparable types", () => {
			expect(expectedTypeForOperator("int", ">")).toBe("int");
			expect(expectedTypeForOperator("int", "<=")).toBe("int");
			expect(expectedTypeForOperator("sol_address", "<")).toBe("sol_address");
			expect(expectedTypeForOperator("string", ">=")).toBe("string");
		});

		it("returns undefined for non-comparable types with comparison operators", () => {
			expect(expectedTypeForOperator("bool", ">")).toBeUndefined();
		});

		it("returns same type for equality operators on any known type", () => {
			expect(expectedTypeForOperator("int", "==")).toBe("int");
			expect(expectedTypeForOperator("bool", "!=")).toBe("bool");
			expect(expectedTypeForOperator("sol_address", "==")).toBe("sol_address");
			expect(expectedTypeForOperator("string", "!=")).toBe("string");
		});

		it("returns undefined for unknown operators", () => {
			expect(expectedTypeForOperator("int", "??")).toBeUndefined();
		});
	});

	describe("isTypeCompatible", () => {
		it("returns true for matching types", () => {
			expect(isTypeCompatible("int", "int")).toBe(true);
			expect(isTypeCompatible("bool", "bool")).toBe(true);
			expect(isTypeCompatible("sol_address", "sol_address")).toBe(true);
		});

		it("returns false for mismatched types", () => {
			expect(isTypeCompatible("int", "bool")).toBe(false);
			expect(isTypeCompatible("sol_address", "int")).toBe(false);
			expect(isTypeCompatible("string", "int")).toBe(false);
		});

		it("returns true when either type is dyn (wildcard)", () => {
			expect(isTypeCompatible("dyn", "int")).toBe(true);
			expect(isTypeCompatible("int", "dyn")).toBe(true);
			expect(isTypeCompatible("dyn", "dyn")).toBe(true);
		});
	});
});
