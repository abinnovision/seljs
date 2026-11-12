import { walkAST } from "../../utils/index.js";

import type { SELDiagnostic } from "../../checker/checker.js";
import type { RuleContext, SELRule } from "../types.js";
import type { ASTNode } from "@marcbachmann/cel-js";

/**
 * Returns true when the runtime `solInt(string)` cast accepts the value.
 * Mirrors the `BigInt(string)` conversion used by the sol_int wrapper.
 */
const isValidSolIntString = (value: string): boolean => {
	try {
		BigInt(value);

		return true;
	} catch {
		return false;
	}
};

/**
 * Flags `solInt("...")` calls whose string literal cannot be converted to an
 * integer, which would otherwise only fail at evaluation time.
 */
export const noInvalidSolIntLiteral: SELRule = {
	name: "no-invalid-sol-int-literal",
	description: "Disallow string literals in solInt() that are not integers.",
	defaultSeverity: "error",
	tier: "structural",

	run(context: RuleContext): SELDiagnostic[] {
		const diagnostics: SELDiagnostic[] = [];

		walkAST(context.ast, (node) => {
			if (node.op !== "call") {
				return;
			}

			const [name, args] = node.args;
			if (name !== "solInt" || args.length !== 1) {
				return;
			}

			const [arg] = args as [ASTNode];
			if (arg.op !== "value" || typeof arg.args !== "string") {
				return;
			}

			if (!isValidSolIntString(arg.args)) {
				diagnostics.push(
					context.report(
						arg,
						`Invalid solInt literal "${arg.args}". Expected a decimal or 0x-prefixed hex integer.`,
					),
				);
			}
		});

		return diagnostics;
	},
};
