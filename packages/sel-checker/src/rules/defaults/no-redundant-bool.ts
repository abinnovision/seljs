import { walkAST } from "../../utils/index.js";

import type { SELDiagnostic } from "../../checker/index.js";
import type { RuleContext, SELRule } from "../types.js";
import type { ASTNode } from "@marcbachmann/cel-js";

/**
 * Flags redundant boolean comparisons: `x == true`, `x != false`, etc.
 */
export const noRedundantBool: SELRule = {
	name: "no-redundant-bool",
	description:
		"Disallow redundant comparisons to boolean literals (true/false).",
	defaultSeverity: "warning",
	tier: "structural",

	run(context: RuleContext) {
		const diagnostics: SELDiagnostic[] = [];

		walkAST(context.ast, (node) => {
			if (node.op !== "==" && node.op !== "!=") {
				return;
			}

			const [left, right] = node.args as [ASTNode, ASTNode];
			const leftIsBool = left.op === "value" && typeof left.args === "boolean";
			const rightIsBool =
				right.op === "value" && typeof right.args === "boolean";

			if (!leftIsBool && !rightIsBool) {
				return;
			}

			const boolValue = leftIsBool ? left.args : (right.args as boolean);
			diagnostics.push(
				context.report(
					node,
					`Redundant comparison to \`${String(boolValue)}\`. Simplify the expression.`,
				),
			);
		});

		return diagnostics;
	},
};
