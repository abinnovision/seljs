import type { SELDiagnostic } from "@seljs/checker";

interface CheckResult {
	valid: boolean;
	error?: Error;
}

/**
 * Maps a TypeCheckResult-shaped object or a caught Error to SELDiagnostic[].
 *
 * Handles both failure modes from `@seljs/runtime`'s `env.check()`:
 * 1. Returned result: `{ valid: false, error: TypeError }`
 * 2. Thrown exception: `SELEvaluationError`
 *
 * Usage:
 * ```ts
 * const validate = (expression: string): SELDiagnostic[] => {
 *   try {
 *     const result = env.check(expression);
 *     return mapCheckResult(result, expression.length);
 *   } catch (error) {
 *     return mapCheckResult(error as Error, expression.length);
 *   }
 * };
 * ```
 */
export const mapCheckResult = (
	resultOrError: CheckResult | Error,
	docLength: number,
): SELDiagnostic[] => {
	// Thrown error path
	if (resultOrError instanceof Error) {
		return [
			{
				message: resultOrError.message,
				severity: "error",
				from: 0,
				to: Math.max(0, docLength),
			},
		];
	}

	// Returned result path
	if (resultOrError.valid) {
		return [];
	}

	const message = resultOrError.error?.message ?? "Invalid expression";

	return [
		{
			message,
			severity: "error",
			from: 0,
			to: Math.max(0, docLength),
		},
	];
};
