import { describe, expect, it } from "vitest";

import { hasCaptureStackTrace } from "./utils.js";

describe("src/errors/utils.ts", () => {
	it("should return true in V8 environments (Node.js)", () => {
		expect(hasCaptureStackTrace(Error)).toBe(true);
	});

	it("should narrow the type to include captureStackTrace", () => {
		expect(typeof Error.captureStackTrace).toBe("function");
	});

	it("should return false for objects without captureStackTrace", () => {
		// Create a minimal object that looks like typeof Error but lacks captureStackTrace
		const fakeError = {
			prototype: Error.prototype,
		} as unknown as typeof Error;
		expect(hasCaptureStackTrace(fakeError)).toBe(false);
	});
});
