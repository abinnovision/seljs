import { walkAST } from "../../utils/index.js";

import type { SELDiagnostic } from "../../checker/index.js";
import type { RuleContext, SELRule } from "../types.js";
import type { ASTNode } from "@marcbachmann/cel-js";

/**
 * Flags conditions that are always true or always false:
 * - `true && x`, `false || x` (boolean literal in logical operator)
 * - Both sides are literal values in a comparison
 */
export const noConstantCondition: SELRule = {
	name: "no-constant-condition",
	description:
		"Disallow constant conditions in logical and comparison operators.",
	defaultSeverity: "warning",
	tier: "structural",

	run(context: RuleContext) {
		const diagnostics: SELDiagnostic[] = [];

		walkAST(context.ast, (node) => {
			// Check && / || with boolean literal operands
			if (node.op === "&&" || node.op === "||") {
				const [left, right] = node.args as [ASTNode, ASTNode];

				if (left.op === "value" && typeof left.args === "boolean") {
					diagnostics.push(
						context.report(
							node,
							`Constant condition: left side of \`${node.op}\` is always \`${String(left.args)}\`.`,
						),
					);
				}

				if (right.op === "value" && typeof right.args === "boolean") {
					diagnostics.push(
						context.report(
							node,
							`Constant condition: right side of \`${node.op}\` is always \`${String(right.args)}\`.`,
						),
					);
				}

				return;
			}

			// Check == / != where both sides are literals
			if (node.op === "==" || node.op === "!=") {
				const [left, right] = node.args as [ASTNode, ASTNode];

				if (left.op === "value" && right.op === "value") {
					diagnostics.push(
						context.report(
							node,
							`Constant condition: both sides of \`${node.op}\` are literal values.`,
						),
					);
				}
			}
		});

		return diagnostics;
	},
};
