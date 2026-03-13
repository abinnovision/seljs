import { nodeSpan } from "../utils/index.js";

import type { RuleContext, RuleTier, SELRule } from "./types.js";
import type { SELDiagnostic } from "../checker/checker.js";
import type { ASTNode } from "@marcbachmann/cel-js";
import type { SELSchema } from "@seljs/schema";

export interface RunRulesOptions {
	expression: string;
	ast: ASTNode;
	schema: SELSchema;
	rules: readonly SELRule[];
	tier: RuleTier;
	resolvedType?: string;
}

/**
 * Run enabled rules of the specified tier against a parsed AST.
 */
export const runRules = ({
	expression,
	ast,
	schema,
	rules,
	tier,
	resolvedType,
}: RunRulesOptions): SELDiagnostic[] => {
	const diagnostics: SELDiagnostic[] = [];

	for (const rule of rules) {
		const ruleTier = rule.tier ?? "structural";
		if (ruleTier !== tier) {
			continue;
		}

		const severity = rule.defaultSeverity;

		const context: RuleContext = {
			expression,
			ast,
			schema,
			severity,
			resolvedType,
			report(node: ASTNode, message: string): SELDiagnostic {
				const span = nodeSpan(node);

				return { message, severity, from: span.from, to: span.to };
			},
			reportAt(from: number, to: number, message: string): SELDiagnostic {
				return { message, severity, from, to };
			},
		};

		diagnostics.push(...rule.run(context));
	}

	return diagnostics;
};
