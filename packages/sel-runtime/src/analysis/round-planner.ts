import { createLogger } from "../debug.js";
import { SELExecutionLimitError } from "../errors/index.js";

import type {
	DependencyGraph,
	ExecutionPlan,
	ExecutionRound,
} from "./types.js";

const debug = createLogger("analysis:plan");

/**
 * Defines limits for the round planner to prevent excessive execution.
 */
export interface RoundPlannerLimits {
	/**
	 * Upper limit on the number of execution rounds.
	 *
	 * @default 10
	 */
	maxRounds?: number;

	/**
	 * Upper limit on the total number of calls in the graph.
	 *
	 * @default 100
	 */
	maxCalls?: number;
}

/**
 * Plans execution rounds from a dependency graph using topological sorting.
 *
 * Groups independent calls into parallel rounds, ensuring all dependencies
 * of a call are executed in previous rounds. Enforces limits on the number
 * of rounds and total calls to prevent excessive execution.
 *
 * @param graph Dependency graph representing calls and their relationships.
 * @param limits Optional limits for maximum rounds and total calls.
 * @returns Execution plan containing planned rounds, total calls, and maximum depth.
 * @throws {@link SELExecutionLimitError} If total calls exceed maxCalls or rounds exceed maxRounds.
 */
export const planRounds = (
	graph: DependencyGraph,
	limits: RoundPlannerLimits = {},
): ExecutionPlan => {
	const maxRounds = limits.maxRounds ?? 10;
	const maxCalls = limits.maxCalls ?? 100;
	const totalCalls = graph.nodes.size;

	if (totalCalls > maxCalls) {
		throw new SELExecutionLimitError(
			`Execution limit exceeded: ${String(totalCalls)} calls exceeds maxCalls (${String(maxCalls)})`,
			{ limitType: "maxCalls", limit: maxCalls, actual: totalCalls },
		);
	}

	if (totalCalls === 0) {
		return { rounds: [], totalCalls: 0, maxDepth: 0 };
	}

	const inDegree = new Map<string, number>();
	for (const nodeId of graph.nodes.keys()) {
		inDegree.set(nodeId, graph.edges.get(nodeId)?.size ?? 0);
	}

	const rounds: ExecutionRound[] = [];
	const processed = new Set<string>();

	while (processed.size < totalCalls) {
		const readyNodes: string[] = [];
		for (const [nodeId, degree] of inDegree) {
			if (degree === 0 && !processed.has(nodeId)) {
				readyNodes.push(nodeId);
			}
		}

		if (readyNodes.length === 0) {
			break;
		}

		if (rounds.length >= maxRounds) {
			throw new SELExecutionLimitError(
				`Execution limit exceeded: requires more than maxRounds (${String(maxRounds)}) rounds`,
				{
					limitType: "maxRounds",
					limit: maxRounds,
					actual: rounds.length + 1,
				},
			);
		}

		const round: ExecutionRound = {
			roundNumber: rounds.length,
			calls: readyNodes
				.map((id) => graph.nodes.get(id)?.call)
				.filter((c) => c !== undefined),
		};

		rounds.push(round);

		for (const nodeId of readyNodes) {
			processed.add(nodeId);
			const node = graph.nodes.get(nodeId);
			if (!node) {
				continue;
			}

			for (const dependentId of node.dependedOnBy) {
				inDegree.set(dependentId, (inDegree.get(dependentId) ?? 0) - 1);
			}
		}
	}

	debug(
		"planned %d rounds for %d calls (max depth=%d)",
		rounds.length,
		totalCalls,
		rounds.length,
	);

	return { rounds, totalCalls, maxDepth: rounds.length };
};
