import { nodeSpan, walkAST } from "../../utils/index.js";

import type { SELDiagnostic } from "../../checker/index.js";
import type { RuleContext, SELRule } from "../types.js";
import type { ASTNode } from "@marcbachmann/cel-js";

/**
 * Check whether a child expression has explicit parentheses in the source.
 * Scans backwards from the child's start position for a `(`.
 */
const hasExplicitParens = (src: string, child: ASTNode): boolean => {
	const span = nodeSpan(child);
	let i = span.from - 1;
	while (i >= 0 && (src[i] === " " || src[i] === "\t")) {
		i--;
	}

	return i >= 0 && src[i] === "(";
};

/**
 * Flags mixed `&&` and `||` without explicit parentheses.
 *
 * The cel-js parser discards parentheses from the AST, so this rule
 * inspects the original source text via `node.input` to determine
 * whether parentheses were explicitly written.
 */
export const noMixedOperators: SELRule = {
	name: "no-mixed-operators",
	description: "Require parentheses when mixing logical operators (&& and ||).",
	defaultSeverity: "info",
	tier: "structural",

	run(context: RuleContext) {
		const diagnostics: SELDiagnostic[] = [];

		walkAST(context.ast, (node) => {
			if (node.op !== "&&" && node.op !== "||") {
				return;
			}

			const opposite = node.op === "&&" ? "||" : "&&";
			const [left, right] = node.args as [ASTNode, ASTNode];

			for (const child of [left, right]) {
				if (child.op === opposite && !hasExplicitParens(node.input, child)) {
					diagnostics.push(
						context.report(
							node,
							"Mixed logical operators without parentheses. Add explicit grouping to clarify precedence.",
						),
					);

					// one diagnostic per node
					break;
				}
			}
		});

		return diagnostics;
	},
};
