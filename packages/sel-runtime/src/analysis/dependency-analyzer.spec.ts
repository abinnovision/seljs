import { describe, expect, it } from "vitest";

import { analyzeDependencies } from "./dependency-analyzer.js";
import { CircularDependencyError } from "../errors/index.js";

import type { CollectedCall } from "./types.js";

const createCall = (
	id: string,
	contract: string,
	method: string,
	args: CollectedCall["args"],
): CollectedCall => ({ id, contract, method, args, astNode: null });

describe("src/analysis/dependency-analyzer.ts", () => {
	it("builds graph for calls with no dependencies", () => {
		const calls: CollectedCall[] = [
			createCall("token:balanceOf:user", "token", "balanceOf", [
				{ type: "variable", variableName: "user" },
			]),
			createCall("nft:balanceOf:user", "nft", "balanceOf", [
				{ type: "variable", variableName: "user" },
			]),
		];

		const graph = analyzeDependencies(calls);

		expect(graph.nodes.size).toBe(2);
		expect(graph.edges.size).toBe(2);
		expect(graph.edges.get("token:balanceOf:user")).toEqual(new Set());
		expect(graph.edges.get("nft:balanceOf:user")).toEqual(new Set());

		expect(graph.nodes.get("token:balanceOf:user")?.dependsOn).toEqual([]);
		expect(graph.nodes.get("token:balanceOf:user")?.dependedOnBy).toEqual([]);
	});

	it("builds direct dependency relationships", () => {
		const calls: CollectedCall[] = [
			createCall("staking:stakedTokenId:user", "staking", "stakedTokenId", [
				{ type: "variable", variableName: "user" },
			]),
			createCall("nft:ownerOf:staking:stakedTokenId:user", "nft", "ownerOf", [
				{
					type: "call_result",
					dependsOnCallId: "staking:stakedTokenId:user",
				},
			]),
		];

		const graph = analyzeDependencies(calls);

		expect(graph.nodes.get("staking:stakedTokenId:user")?.dependedOnBy).toEqual(
			["nft:ownerOf:staking:stakedTokenId:user"],
		);
		expect(
			graph.nodes.get("nft:ownerOf:staking:stakedTokenId:user")?.dependsOn,
		).toEqual(["staking:stakedTokenId:user"]);
		expect(graph.edges.get("nft:ownerOf:staking:stakedTokenId:user")).toEqual(
			new Set(["staking:stakedTokenId:user"]),
		);
	});

	it("builds multi-level dependency chain", () => {
		const calls: CollectedCall[] = [
			createCall("A", "token", "a", [
				{ type: "variable", variableName: "user" },
			]),
			createCall("B", "token", "b", [
				{ type: "call_result", dependsOnCallId: "A" },
			]),
			createCall("C", "token", "c", [
				{ type: "call_result", dependsOnCallId: "B" },
			]),
		];

		const graph = analyzeDependencies(calls);

		expect(graph.nodes.get("A")?.dependedOnBy).toEqual(["B"]);
		expect(graph.nodes.get("B")?.dependsOn).toEqual(["A"]);
		expect(graph.nodes.get("B")?.dependedOnBy).toEqual(["C"]);
		expect(graph.nodes.get("C")?.dependsOn).toEqual(["B"]);
	});

	it("throws CircularDependencyError for circular dependency", () => {
		const calls: CollectedCall[] = [
			createCall("A", "token", "a", [
				{ type: "call_result", dependsOnCallId: "B" },
			]),
			createCall("B", "token", "b", [
				{ type: "call_result", dependsOnCallId: "A" },
			]),
		];

		let captured: unknown;

		try {
			analyzeDependencies(calls);
		} catch (error) {
			captured = error;
		}

		expect(captured).toBeInstanceOf(CircularDependencyError);
		expect((captured as CircularDependencyError).callIds).toEqual(
			expect.arrayContaining(["A", "B"]),
		);
	});

	it("returns empty graph for empty calls", () => {
		const graph = analyzeDependencies([]);

		expect(graph.nodes.size).toBe(0);
		expect(graph.edges.size).toBe(0);
	});
});
