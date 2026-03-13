import { serialize } from "@marcbachmann/cel-js";

import { walkAST } from "../../utils/index.js";

import type { SELDiagnostic } from "../../checker/checker.js";
import type { RuleContext, SELRule } from "../types.js";
import type { ASTNode } from "@marcbachmann/cel-js";

const COMPARISON_OPS = new Set(["==", "!=", "<", "<=", ">", ">="]);

const ALWAYS_TRUE_OPS = new Set(["==", "<=", ">="]);

/**
 * Flags comparisons where both sides are the same expression (tautology/contradiction).
 *
 * Uses `serialize()` for identity comparison (safe for this purpose —
 * normalization is acceptable when comparing subtree identity, unlike
 * span calculation where it would produce incorrect positions).
 */
export const noSelfComparison: SELRule = {
	name: "no-self-comparison",
	description: "Disallow comparing an expression to itself.",
	defaultSeverity: "warning",
	tier: "structural",

	run(context: RuleContext): SELDiagnostic[] {
		const diagnostics: SELDiagnostic[] = [];

		walkAST(context.ast, (node) => {
			if (!COMPARISON_OPS.has(node.op)) {
				return;
			}

			const [left, right] = node.args as [ASTNode, ASTNode];

			if (serialize(left) === serialize(right)) {
				const alwaysResult = ALWAYS_TRUE_OPS.has(node.op) ? "true" : "false";
				diagnostics.push(
					context.report(
						node,
						`Both sides of \`${node.op}\` are identical. This is always \`${alwaysResult}\`.`,
					),
				);
			}
		});

		return diagnostics;
	},
};
