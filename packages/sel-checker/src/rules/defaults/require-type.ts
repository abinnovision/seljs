import type { SELDiagnostic } from "../../checker/index.js";
import type { RuleContext, SELRule } from "../types.js";

/**
 * Rule factory that enforces an expression evaluates to the expected CEL type.
 *
 * @param expected - The CEL type name the expression must resolve to (e.g. "bool", "uint256")
 */
export const requireType = (expected: string): SELRule => ({
	name: `require-type-${expected}`,
	description: `Expression must evaluate to ${expected}.`,
	defaultSeverity: "error",
	tier: "type-aware",

	run(context: RuleContext): SELDiagnostic[] {
		if (context.resolvedType === expected) {
			return [];
		}

		return [
			context.reportAt(
				0,
				context.expression.length,
				`Expected expression to evaluate to "${expected}", but got "${String(context.resolvedType)}".`,
			),
		];
	},
});
