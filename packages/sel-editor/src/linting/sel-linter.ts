import { linter, type Diagnostic } from "@codemirror/lint";

import type { Extension } from "@codemirror/state";
import type { SELDiagnostic } from "@seljs/checker";

const SEVERITY_MAP: Record<SELDiagnostic["severity"], Diagnostic["severity"]> =
	{
		error: "error",
		warning: "warning",
		info: "info",
	};

const mapToCMDiagnostic = (
	diag: SELDiagnostic,
	docLength: number,
): Diagnostic => {
	const from = diag.from ?? 0;
	const to = diag.to ?? docLength;

	return {
		from: Math.max(0, Math.min(from, docLength)),
		to: Math.max(0, Math.min(to, docLength)),
		severity: SEVERITY_MAP[diag.severity],
		message: diag.message,
	};
};

export interface SELLinterOptions {
	/**
	 * Validate an expression, return diagnostics
	 */
	validate: (expression: string) => SELDiagnostic[] | Promise<SELDiagnostic[]>;

	/**
	 * Debounce delay in ms (default: 300)
	 */
	delay?: number;
}

export const createSELLinter = (options: SELLinterOptions): Extension =>
	linter(
		async (view) => {
			const doc = view.state.doc.toString();
			if (!doc) {
				return [];
			}

			const diagnostics = await options.validate(doc);
			const docLength = doc.length;

			return diagnostics.map((d) => mapToCMDiagnostic(d, docLength));
		},
		{ delay: options.delay ?? 300 },
	);
