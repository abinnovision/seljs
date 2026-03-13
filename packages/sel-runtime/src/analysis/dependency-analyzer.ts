import { createLogger } from "../debug.js";
import { CircularDependencyError } from "../errors/index.js";

import type { CollectedCall, DependencyGraph, GraphNode } from "./types.js";

const debug = createLogger("analysis:dependency");

/**
 * Detects circular dependencies in the graph using DFS with a recursion stack.
 *
 * @throws {@link CircularDependencyError} If a cycle is found, including the call IDs forming the cycle
 */
const detectCycles = (
	nodes: Map<string, GraphNode>,
	edges: Map<string, Set<string>>,
): void => {
	const visited = new Set<string>();
	const inStack = new Set<string>();

	const dfs = (nodeId: string, path: string[]): void => {
		if (inStack.has(nodeId)) {
			const cycleStart = path.indexOf(nodeId);
			const cycle = path.slice(cycleStart);
			throw new CircularDependencyError(
				`Circular dependency detected: ${cycle.join(" -> ")} -> ${nodeId}`,
				{ callIds: cycle },
			);
		}

		if (visited.has(nodeId)) {
			return;
		}

		visited.add(nodeId);
		inStack.add(nodeId);
		path.push(nodeId);

		for (const depId of edges.get(nodeId) ?? []) {
			dfs(depId, path);
		}

		path.pop();
		inStack.delete(nodeId);
	};

	for (const nodeId of nodes.keys()) {
		if (!visited.has(nodeId)) {
			dfs(nodeId, []);
		}
	}
};

/**
 * Builds a dependency graph from collected contract calls.
 *
 * Creates a directed graph where nodes represent contract calls and edges
 * represent data dependencies (when one call's argument is the result of
 * another call). Validates that no circular dependencies exist.
 *
 * @param calls - Array of collected contract calls from AST traversal
 * @returns A dependency graph with nodes and directed edges
 * @throws {@link CircularDependencyError} If a circular dependency is detected between calls
 */
export const analyzeDependencies = (
	calls: CollectedCall[],
): DependencyGraph => {
	const nodes = new Map<string, GraphNode>();
	const edges = new Map<string, Set<string>>();

	// First pass: create a node and empty edge set for each call
	for (const call of calls) {
		nodes.set(call.id, { call, dependsOn: [], dependedOnBy: [] });
		edges.set(call.id, new Set());
	}

	// Second pass: wire up dependency edges from call_result arguments
	for (const call of calls) {
		for (const arg of call.args) {
			if (arg.type === "call_result" && arg.dependsOnCallId) {
				const depId = arg.dependsOnCallId;
				edges.get(call.id)?.add(depId);

				const callNode = nodes.get(call.id);
				if (callNode && !callNode.dependsOn.includes(depId)) {
					callNode.dependsOn.push(depId);
				}

				const depNode = nodes.get(depId);
				if (depNode && !depNode.dependedOnBy.includes(call.id)) {
					depNode.dependedOnBy.push(call.id);
				}
			}
		}
	}

	// Run cycle detection to ensure there are no circular dependencies in the graph.
	detectCycles(nodes, edges);

	debug(
		"graph: %d nodes, %d edges",
		nodes.size,
		[...edges.values()].reduce((sum, deps) => sum + deps.size, 0),
	);

	return { nodes, edges };
};
