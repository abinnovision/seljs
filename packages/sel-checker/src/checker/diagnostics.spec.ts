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

		it("computes absolute offset for error on line 2", () => {
			/*
			 * Expression: "contract.getPoints(wallet)\n>" (26 chars on line 1 + newline)
			 * cel-js format: caret at column 1 (10 spaces, 9-char prefix)
			 */
			const error = new Error(
				"Unexpected token: EOF\n\n>    2 | >\n          ^",
			);
			error.name = "ParseError";

			const expression = "contract.getPoints(wallet)\n>";
			const diagnostics = extractDiagnostics(expression, error);

			expect(diagnostics).toHaveLength(1);

			// Line 2 starts at offset 27, caret column 1 → absolute 28
			expect(diagnostics[0]?.from).toBe(28);
			expect(diagnostics[0]?.to).toBe(29);
		});

		it("computes absolute offset for error on line 3 with varying line lengths", () => {
			/*
			 * Line 1: "ab" (2 chars), Line 2: "cdef" (4 chars), Line 3: "g"
			 * Line 3 starts at offset 8 (2+1+4+1), caret column 1 → absolute 9
			 */
			const error = new Error(
				"undeclared reference: g\n\n>    3 | g\n          ^",
			);
			error.name = "ParseError";

			const expression = "ab\ncdef\ng";
			const diagnostics = extractDiagnostics(expression, error);

			expect(diagnostics).toHaveLength(1);
			expect(diagnostics[0]?.from).toBe(9);
			expect(diagnostics[0]?.to).toBe(10);
		});

		it("handles error at column 0 of line 2", () => {
			/*
			 * Line 1: "foo" (3 chars), line 2 starts at offset 4
			 * cel-js caret at 9 spaces = column 0
			 */
			const error = new Error(
				"Unexpected token: bar\n\n>    2 | bar\n         ^",
			);
			error.name = "ParseError";

			const expression = "foo\nbar";
			const diagnostics = extractDiagnostics(expression, error);

			expect(diagnostics).toHaveLength(1);
			expect(diagnostics[0]?.from).toBe(4);
			expect(diagnostics[0]?.to).toBe(5);
		});

		it("handles empty line in expression", () => {
			/*
			 * Line 1: "foo" (3 chars), Line 2: "" (0 chars), Line 3: "bar"
			 * Line 3 starts at offset 5 (3+1+0+1), caret column 1 → absolute 6
			 */
			const error = new Error(
				"undeclared reference: bar\n\n>    3 | bar\n          ^",
			);
			error.name = "ParseError";

			const expression = "foo\n\nbar";
			const diagnostics = extractDiagnostics(expression, error);

			expect(diagnostics).toHaveLength(1);
			expect(diagnostics[0]?.from).toBe(6);
			expect(diagnostics[0]?.to).toBe(7);
		});

		it("falls back gracefully when line number exceeds actual lines", () => {
			// Malformed: claims line 5 but expression has only 2 lines
			const error = new Error("some error\n\n>    5 | x\n          ^");

			const expression = "foo\nbar";
			const diagnostics = extractDiagnostics(expression, error);

			// Should fall back to full expression span
			expect(diagnostics).toHaveLength(1);
			expect(diagnostics[0]?.from).toBe(0);
			expect(diagnostics[0]?.to).toBe(expression.length);
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
