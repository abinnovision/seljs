import { describe, expect, it } from "vitest";

import { SELError } from "./base.js";

describe("src/errors/base.ts", () => {
	it("should be an instance of Error", () => {
		const error = new SELError("test message");
		expect(error instanceof Error).toBe(true);
	});

	it("should be an instance of SELError", () => {
		const error = new SELError("test message");
		expect(error instanceof SELError).toBe(true);
	});

	it("should have correct name property", () => {
		const error = new SELError("test message");
		expect(error.name).toBe("SELError");
	});

	it("should have correct message property", () => {
		const error = new SELError("test message");
		expect(error.message).toBe("test message");
	});

	it("should support cause option", () => {
		const originalError = new Error("original");
		const error = new SELError("wrapped", { cause: originalError });
		expect(error.cause).toBe(originalError);
	});

	it("should work without cause option", () => {
		const error = new SELError("test message");
		expect(error.cause).toBeUndefined();
	});

	it("should have a stack trace", () => {
		const error = new SELError("test message");
		expect(error.stack).toBeDefined();
	});

	it("should use subclass name when extended", () => {
		class CustomError extends SELError {}
		const error = new CustomError("test");
		expect(error.name).toBe("CustomError");
	});
});
