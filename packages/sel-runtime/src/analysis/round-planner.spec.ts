import { describe, expect, it } from "vitest";

import { planRounds } from "./round-planner.js";
import { SELExecutionLimitError } from "../errors/index.js";

import type { CollectedCall, DependencyGraph, GraphNode } from "./types.js";

const createCall = (id: string): CollectedCall => ({
	id,
	contract: "token",
	method: "balanceOf",
	args: [],
	astNode: null,
});

const createGraph = (
	definitions: Array<{ id: string; dependsOn?: string[] }>,
): DependencyGraph => {
	const nodes = new Map<string, GraphNode>();
	const edges = new Map<string, Set<string>>();

	for (const { id, dependsOn = [] } of definitions) {
		nodes.set(id, {
			call: createCall(id),
			dependsOn: [...dependsOn],
			dependedOnBy: [],
		});

		edges.set(id, new Set(dependsOn));
	}

	for (const { id, dependsOn = [] } of definitions) {
		for (const dependencyId of dependsOn) {
			const dependencyNode = nodes.get(dependencyId);
			if (dependencyNode && !dependencyNode.dependedOnBy.includes(id)) {
				dependencyNode.dependedOnBy.push(id);
			}
		}
	}

	return { nodes, edges };
};

describe("src/analysis/round-planner.ts", () => {
	it("plans independent calls in round 0", () => {
		const graph = createGraph([{ id: "A" }, { id: "B" }, { id: "C" }]);

		const plan = planRounds(graph);

		expect(plan.rounds).toHaveLength(1);
		expect(plan.rounds[0]?.roundNumber).toBe(0);
		expect(plan.rounds[0]?.calls).toHaveLength(3);
		expect(plan.totalCalls).toBe(3);
		expect(plan.maxDepth).toBe(1);
	});

	it("plans a linear chain A -> B -> C into three rounds", () => {
		const graph = createGraph([
			{ id: "A" },
			{ id: "B", dependsOn: ["A"] },
			{ id: "C", dependsOn: ["B"] },
		]);

		const plan = planRounds(graph);

		expect(plan.rounds).toHaveLength(3);
		expect(plan.rounds[0]?.calls.map((call) => call.id)).toEqual(["A"]);
		expect(plan.rounds[1]?.calls.map((call) => call.id)).toEqual(["B"]);
		expect(plan.rounds[2]?.calls.map((call) => call.id)).toEqual(["C"]);
		expect(plan.maxDepth).toBe(3);
	});

	it("plans diamond dependencies with parallel middle round", () => {
		const graph = createGraph([
			{ id: "A" },
			{ id: "B", dependsOn: ["A"] },
			{ id: "C", dependsOn: ["A"] },
			{ id: "D", dependsOn: ["B", "C"] },
		]);

		const plan = planRounds(graph);

		expect(plan.rounds).toHaveLength(3);
		expect(plan.rounds[0]?.calls.map((call) => call.id)).toEqual(["A"]);
		expect(plan.rounds[1]?.calls.map((call) => call.id)).toEqual(["B", "C"]);
		expect(plan.rounds[2]?.calls.map((call) => call.id)).toEqual(["D"]);
	});

	it("throws SELExecutionLimitError when maxRounds is exceeded", () => {
		const graph = createGraph([
			{ id: "A" },
			{ id: "B", dependsOn: ["A"] },
			{ id: "C", dependsOn: ["B"] },
		]);

		let captured: unknown;
		try {
			planRounds(graph, { maxRounds: 2 });
		} catch (error) {
			captured = error;
		}

		expect(captured).toBeInstanceOf(SELExecutionLimitError);
		expect((captured as SELExecutionLimitError).limitType).toBe("maxRounds");
	});

	it("throws SELExecutionLimitError when maxCalls is exceeded", () => {
		const graph = createGraph([{ id: "A" }, { id: "B" }, { id: "C" }]);

		let captured: unknown;
		try {
			planRounds(graph, { maxCalls: 2 });
		} catch (error) {
			captured = error;
		}

		expect(captured).toBeInstanceOf(SELExecutionLimitError);
		expect((captured as SELExecutionLimitError).limitType).toBe("maxCalls");
	});

	it("returns empty plan for empty graph", () => {
		const graph = createGraph([]);

		const plan = planRounds(graph);

		expect(plan.rounds).toEqual([]);
		expect(plan.totalCalls).toBe(0);
		expect(plan.maxDepth).toBe(0);
	});
});
