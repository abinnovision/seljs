import { describe, expect, it } from "vitest";

import { extractDiagnostics } from "./diagnostics.js";

describe("src/checker/diagnostics.ts", () => {
	describe("extractDiagnostics", () => {
		it("extracts position from a cel-js ParseError message", () => {
			const error = new Error(
				"Expected IDENTIFIER, got DOT\n\n>    1 | invalid..expr\n                 ^",
			);
			error.name = "ParseError";

			const diagnostics = extractDiagnostics("invalid..expr", error);

			expect(diagnostics).toHaveLength(1);
			expect(diagnostics[0]?.severity).toBe("error");
			expect(diagnostics[0]?.message).toBe("Expected IDENTIFIER, got DOT");
			expect(diagnostics[0]?.from).toBe(8);
			expect(diagnostics[0]?.to).toBe(9);
		});

		it("extracts position from a cel-js TypeError message", () => {
			const error = new Error(
				"no such overload: uint256 + bool\n\n>    1 | x + true\n           ^",
			);
			error.name = "TypeError";

			const diagnostics = extractDiagnostics("x + true", error);

			expect(diagnostics).toHaveLength(1);
			expect(diagnostics[0]?.message).toBe("no such overload: uint256 + bool");
			expect(diagnostics[0]?.from).toBe(2);
			expect(diagnostics[0]?.to).toBe(3);
		});

		it("falls back to full expression span when no position available", () => {
			const error = new Error("Something went wrong");

			const diagnostics = extractDiagnostics("some expression", error);

			expect(diagnostics).toHaveLength(1);
			expect(diagnostics[0]?.from).toBe(0);
			expect(diagnostics[0]?.to).toBe(15);
		});

		it("handles non-Error values", () => {
			const diagnostics = extractDiagnostics("expr", "string error");

			expect(diagnostics).toHaveLength(1);
			expect(diagnostics[0]?.message).toBe("string error");
			expect(diagnostics[0]?.from).toBe(0);
			expect(diagnostics[0]?.to).toBe(4);
		});

		it("extracts clean message without code-line decoration", () => {
			const error = new Error(
				"undeclared reference: foo\n\n>    1 | foo + bar\n         ^",
			);

			const diagnostics = extractDiagnostics("foo + bar", error);

			expect(diagnostics[0]?.message).toBe("undeclared reference: foo");
		});
	});
});
