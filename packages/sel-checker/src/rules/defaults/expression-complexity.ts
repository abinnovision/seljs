import { isAstNode } from "@seljs/common";

import { collectChildren } from "../../utils/index.js";

import type { SELDiagnostic } from "../../checker/checker.js";
import type { RuleContext, SELRule } from "../types.js";
import type { ASTNode } from "@marcbachmann/cel-js";

// eslint-disable-next-line import/exports-last -- interface must precede its usage
export interface ComplexityThresholds {
	maxAstNodes: number;
	maxDepth: number;
	maxCalls: number;
	maxOperators: number;
	maxBranches: number;
}

const DEFAULT_THRESHOLDS: ComplexityThresholds = {
	maxAstNodes: 50,
	maxDepth: 8,
	maxCalls: 10,
	maxOperators: 15,
	maxBranches: 6,
};

/** Binary ops that count toward the operators metric (excludes && and ||). */
const COUNTING_BINARY_OPS = new Set([
	"==",
	"!=",
	"<",
	"<=",
	">",
	">=",
	"+",
	"-",
	"*",
	"/",
	"%",
	"in",
	"[]",
	"[?]",
]);

interface Metrics {
	nodes: number;
	maxDepth: number;
	calls: number;
	operators: number;
	branches: number;
}

interface CountMetricsArgs {
	node: ASTNode;
	depth: number;
	contractNames: Set<string>;
}

/**
 * Recursively count all complexity metrics in a single AST pass.
 */
const countMetrics = (
	{ node, depth, contractNames }: CountMetricsArgs,
	metrics: Metrics,
): void => {
	metrics.nodes++;

	if (depth > metrics.maxDepth) {
		metrics.maxDepth = depth;
	}

	// Contract calls: rcall where receiver is an id whose name is a contract
	if (node.op === "rcall") {
		const nodeArgs = node.args as unknown[];
		const receiverNode = nodeArgs[1];

		if (
			isAstNode(receiverNode) &&
			receiverNode.op === "id" &&
			typeof receiverNode.args === "string" &&
			contractNames.has(receiverNode.args)
		) {
			metrics.calls++;
		}
	}

	// Branches: ternary (?:), logical && and ||
	if (node.op === "?:" || node.op === "&&" || node.op === "||") {
		metrics.branches++;
	}

	// Operators: binary ops excluding && and ||; plus unary ops
	if (
		COUNTING_BINARY_OPS.has(node.op) ||
		node.op === "!_" ||
		node.op === "-_"
	) {
		metrics.operators++;
	}

	for (const child of collectChildren(node)) {
		countMetrics({ node: child, depth: depth + 1, contractNames }, metrics);
	}
};

/**
 * Factory that enforces expression complexity thresholds.
 *
 * Reports a diagnostic for each metric that exceeds its configured maximum.
 * Setting a threshold to `Infinity` disables that metric.
 */
export const expressionComplexity = (
	thresholds?: Partial<ComplexityThresholds>,
): SELRule => {
	const resolved: ComplexityThresholds = {
		...DEFAULT_THRESHOLDS,
		...thresholds,
	};

	return {
		name: "expression-complexity",
		description: "Reject expressions exceeding AST complexity thresholds.",
		defaultSeverity: "error",
		tier: "structural",

		run(context: RuleContext): SELDiagnostic[] {
			const contractNames = new Set(
				context.schema.contracts.map((c) => c.name),
			);

			const metrics: Metrics = {
				nodes: 0,
				maxDepth: 0,
				calls: 0,
				operators: 0,
				branches: 0,
			};

			countMetrics({ node: context.ast, depth: 0, contractNames }, metrics);

			const diagnostics: SELDiagnostic[] = [];
			const span = context.expression.length;

			if (metrics.nodes > resolved.maxAstNodes) {
				diagnostics.push(
					context.reportAt(
						0,
						span,
						`Expression complexity: AST node count ${String(metrics.nodes)} exceeds maximum of ${String(resolved.maxAstNodes)}.`,
					),
				);
			}

			if (metrics.maxDepth > resolved.maxDepth) {
				diagnostics.push(
					context.reportAt(
						0,
						span,
						`Expression complexity: nesting depth ${String(metrics.maxDepth)} exceeds maximum of ${String(resolved.maxDepth)}.`,
					),
				);
			}

			if (metrics.calls > resolved.maxCalls) {
				diagnostics.push(
					context.reportAt(
						0,
						span,
						`Expression complexity: contract calls ${String(metrics.calls)} exceeds maximum of ${String(resolved.maxCalls)}.`,
					),
				);
			}

			if (metrics.operators > resolved.maxOperators) {
				diagnostics.push(
					context.reportAt(
						0,
						span,
						`Expression complexity: operators ${String(metrics.operators)} exceeds maximum of ${String(resolved.maxOperators)}.`,
					),
				);
			}

			if (metrics.branches > resolved.maxBranches) {
				diagnostics.push(
					context.reportAt(
						0,
						span,
						`Expression complexity: branches ${String(metrics.branches)} exceeds maximum of ${String(resolved.maxBranches)}.`,
					),
				);
			}

			return diagnostics;
		},
	};
};
