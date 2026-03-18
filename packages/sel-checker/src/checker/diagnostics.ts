import type { SELDiagnostic } from "./checker.js";

/**
 * Extract position information from a cel-js error message.
 *
 * cel-js error messages embed a caret (`^`) on a separate line indicating
 * the error column. The format is:
 * ```
 * Error description
 *
 * >    1 | expression text
 *              ^
 * ```
 *
 * We parse the caret offset relative to the code line prefix (`>    N | `)
 * to derive the zero-based character offset within the expression.
 */
const extractPositionFromMessage = (
	message: string,
	expression: string,
): { from: number; to: number } | undefined => {
	const lines = message.split("\n");
	const caretLine = lines.find((line) => /^\s*\^+\s*$/.test(line));

	if (!caretLine) {
		return undefined;
	}

	const codeLine = lines.find((line) => line.startsWith(">"));
	if (!codeLine) {
		return undefined;
	}

	const pipeIndex = codeLine.indexOf("|");
	if (pipeIndex === -1) {
		return undefined;
	}

	// Prefix length includes the pipe and the space after it: ">    1 | "
	const prefixLength = pipeIndex + 2;
	const caretStart = caretLine.indexOf("^");
	const caretEnd = caretLine.lastIndexOf("^");

	const column = caretStart - prefixLength;
	const columnEnd = caretEnd - prefixLength + 1;

	if (column < 0) {
		return undefined;
	}

	/*
	 * Parse the 1-based line number from the ">    N | " prefix to compute
	 * absolute offsets for multi-line expressions. cel-js reports caret
	 * positions relative to the error line; we need document-absolute offsets.
	 */
	const lineMatch = codeLine.match(/^>\s+(\d+)\s*\|/);
	const lineNumber = lineMatch ? Number(lineMatch[1]) : 1;

	// Compute the byte offset where this line starts in the expression
	const expressionLines = expression.split("\n");

	// If line number exceeds actual lines, fall back to full-expression span
	if (lineNumber > expressionLines.length) {
		return undefined;
	}

	let baseOffset = 0;
	for (let i = 0; i < lineNumber - 1; i++) {
		const line = expressionLines[i];
		if (line === undefined) {
			return undefined;
		}

		baseOffset += line.length + 1;
	}

	return { from: baseOffset + column, to: baseOffset + columnEnd };
};

/**
 * Extract the plain error message without the caret/code-line decoration.
 */
const extractPlainMessage = (message: string): string => {
	const lines = message.split("\n");
	const plainLines = lines.filter(
		(line) =>
			!line.startsWith(">") &&
			!/^\s*\^+\s*$/.test(line) &&
			line.trim().length > 0,
	);

	return plainLines.join(" ").trim() || message;
};

/**
 * Convert a cel-js error into position-aware SEL diagnostics.
 *
 * The error's `name` property distinguishes parse errors (`"ParseError"`)
 * from type errors (`"TypeError"`).  Position information is extracted from
 * the caret annotation embedded in the error message; when absent the
 * diagnostic spans the entire expression.
 */
export const extractDiagnostics = (
	expression: string,
	error: unknown,
): SELDiagnostic[] => {
	if (!(error instanceof Error)) {
		return [
			{
				message: String(error),
				severity: "error",
				from: 0,
				to: expression.length,
			},
		];
	}

	const position = extractPositionFromMessage(error.message, expression);
	const message = extractPlainMessage(error.message);

	return [
		{
			message,
			severity: "error",
			from: position?.from ?? 0,
			to: position?.to ?? expression.length,
		},
	];
};
