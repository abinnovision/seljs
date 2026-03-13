import { describe, expect, it } from "vitest";

import { SELError } from "./base.js";
import { SELParseError, SELTypeError } from "./errors.js";

describe("src/errors/errors.ts", () => {
	describe("sELParseError", () => {
		it("should be an instance of Error", () => {
			const error = new SELParseError("test message");
			expect(error instanceof Error).toBe(true);
		});

		it("should be an instance of SELParseError", () => {
			const error = new SELParseError("test message");
			expect(error instanceof SELParseError).toBe(true);
		});

		it("should be an instance of SELError", () => {
			const error = new SELParseError("test message");
			expect(error instanceof SELError).toBe(true);
		});

		it("should have correct name property", () => {
			const error = new SELParseError("test message");
			expect(error.name).toBe("SELParseError");
		});

		it("should have correct message property", () => {
			const error = new SELParseError("test message");
			expect(error.message).toBe("test message");
		});

		it("should support cause option", () => {
			const originalError = new Error("original");
			const error = new SELParseError("wrapped", { cause: originalError });
			expect(error.cause).toBe(originalError);
		});

		it("should work without cause option", () => {
			const error = new SELParseError("test message");
			expect(error.cause).toBeUndefined();
		});
	});

	describe("sELTypeError", () => {
		it("should be an instance of Error", () => {
			const error = new SELTypeError("test message");
			expect(error instanceof Error).toBe(true);
		});

		it("should be an instance of SELTypeError", () => {
			const error = new SELTypeError("test message");
			expect(error instanceof SELTypeError).toBe(true);
		});

		it("should be an instance of SELError", () => {
			const error = new SELTypeError("test message");
			expect(error instanceof SELError).toBe(true);
		});

		it("should have correct name property", () => {
			const error = new SELTypeError("test message");
			expect(error.name).toBe("SELTypeError");
		});

		it("should have correct message property", () => {
			const error = new SELTypeError("test message");
			expect(error.message).toBe("test message");
		});

		it("should support cause option", () => {
			const originalError = new Error("original");
			const error = new SELTypeError("wrapped", { cause: originalError });
			expect(error.cause).toBe(originalError);
		});

		it("should work without cause option", () => {
			const error = new SELTypeError("test message");
			expect(error.cause).toBeUndefined();
		});
	});

	describe("error class distinctions", () => {
		it("should distinguish between different error types", () => {
			const parseError = new SELParseError("parse");
			const typeError = new SELTypeError("type");

			expect(parseError instanceof SELParseError).toBe(true);
			expect(parseError instanceof SELTypeError).toBe(false);

			expect(typeError instanceof SELTypeError).toBe(true);
			expect(typeError instanceof SELParseError).toBe(false);
		});

		it("should all be instances of SELError and Error", () => {
			const parseError = new SELParseError("parse");
			const typeError = new SELTypeError("type");

			expect(parseError instanceof SELError).toBe(true);
			expect(typeError instanceof SELError).toBe(true);

			expect(parseError instanceof Error).toBe(true);
			expect(typeError instanceof Error).toBe(true);
		});
	});

	describe("error wrapping with cause", () => {
		it("should wrap multiple levels of errors", () => {
			const originalError = new Error("original");
			const wrappedError = new SELParseError("wrapped", {
				cause: originalError,
			});
			const finalError = new SELTypeError("final", {
				cause: wrappedError,
			});

			expect(finalError.cause).toBe(wrappedError);
			expect((finalError.cause as Error).cause).toBe(originalError);
		});

		it("should preserve error messages through wrapping", () => {
			const originalError = new Error("original message");
			const wrappedError = new SELParseError("wrapped message", {
				cause: originalError,
			});

			expect(wrappedError.message).toBe("wrapped message");
			expect((wrappedError.cause as Error).message).toBe("original message");
		});
	});
});
