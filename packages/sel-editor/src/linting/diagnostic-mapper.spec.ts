import { describe, expect, it } from "vitest";

import { mapCheckResult } from "./diagnostic-mapper";

describe("src/linting/diagnostic-mapper.ts", () => {
	it("returns empty array for valid result", () => {
		const result = mapCheckResult({ valid: true }, 10);
		expect(result).toEqual([]);
	});

	it("returns diagnostic for invalid result with error", () => {
		const result = mapCheckResult(
			{ valid: false, error: new TypeError("type mismatch") },
			20,
		);
		expect(result).toHaveLength(1);
		expect(result[0]!.message).toBe("type mismatch");
		expect(result[0]!.severity).toBe("error");
		expect(result[0]!.from).toBe(0);
		expect(result[0]!.to).toBe(20);
	});

	it("returns diagnostic for invalid result without error", () => {
		const result = mapCheckResult({ valid: false }, 15);
		expect(result).toHaveLength(1);
		expect(result[0]!.message).toBe("Invalid expression");
	});

	it("returns diagnostic for thrown Error", () => {
		const result = mapCheckResult(new Error("parse error"), 10);
		expect(result).toHaveLength(1);
		expect(result[0]!.message).toBe("parse error");
		expect(result[0]!.severity).toBe("error");
		expect(result[0]!.from).toBe(0);
		expect(result[0]!.to).toBe(10);
	});

	it("handles zero docLength gracefully", () => {
		const result = mapCheckResult(new Error("empty"), 0);
		expect(result).toHaveLength(1);
		expect(result[0]!.from).toBe(0);
		expect(result[0]!.to).toBe(0);
	});

	it("handles negative docLength by clamping to 0", () => {
		const result = mapCheckResult(new Error("test"), -5);
		expect(result).toHaveLength(1);
		expect(result[0]!.to).toBe(0);
	});
});
