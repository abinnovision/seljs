import type { SELDiagnostic } from "../checker/checker.js";
import type { ASTNode } from "@marcbachmann/cel-js";
import type { SELSchema } from "@seljs/schema";

/**
 * Severity levels for rules.
 */
export type RuleSeverity = "error" | "warning" | "info";

/**
 * Tier determines when a rule runs:
 * - "structural": runs on any successfully-parsed expression, even if type-check fails
 * - "type-aware": runs only when both parse and type-check succeed
 */
export type RuleTier = "structural" | "type-aware";

/**
 * Context passed to each rule's run function.
 */
export interface RuleContext {
	/**
	 * The raw expression string.
	 */
	expression: string;

	/**
	 * The parsed AST root node.
	 */
	ast: ASTNode;

	/**
	 * The active schema (contracts, variables, types, functions).
	 */
	schema: SELSchema;

	/**
	 * The resolved severity for this rule invocation.
	 */
	severity: RuleSeverity;

	/**
	 * Resolved CEL type of the full expression. Only set for type-aware rules.
	 */
	resolvedType?: string;

	/**
	 * Create a diagnostic spanning an AST node's source range.
	 */
	report: (node: ASTNode, message: string) => SELDiagnostic;

	/**
	 * Create a diagnostic at an explicit position range.
	 */
	reportAt: (from: number, to: number, message: string) => SELDiagnostic;
}

/**
 * A lint rule that analyzes a parsed expression and reports diagnostics.
 */
export interface SELRule {
	/**
	 * Unique rule identifier (kebab-case, e.g. "no-redundant-bool").
	 */
	name: string;

	/**
	 * Human-readable description.
	 */
	description: string;

	/**
	 * Severity level for diagnostics reported by this rule.
	 */
	defaultSeverity: RuleSeverity;

	/**
	 * Execution tier. Defaults to "structural" if omitted.
	 * - "structural": rule receives AST even when type-check failed
	 * - "type-aware": rule only runs after successful type-check
	 */
	tier?: RuleTier;

	/**
	 * Analyze the expression and return diagnostics.
	 */
	run: (context: RuleContext) => SELDiagnostic[];
}
