import { describe, expect, it } from "vitest";

import { expressionComplexity } from "./expression-complexity.js";
import { SELChecker } from "../../checker/checker.js";

import type { ContractSchema, MethodSchema, SELSchema } from "@seljs/schema";

/**
 * Creates a method schema for tests.
 * The `abi` field is required by MethodSchema but unused by the checker.
 */
const method = (m: Omit<MethodSchema, "abi">): MethodSchema =>
	m as MethodSchema;

/**
 * Creates a contract schema for tests.
 * The `address` field is required by ContractSchema but unused by the checker.
 */
const contract = (c: Omit<ContractSchema, "address">): ContractSchema =>
	c as ContractSchema;

const TEST_SCHEMA: SELSchema = {
	version: "1.0.0",
	contracts: [
		contract({
			name: "token",
			methods: [
				method({
					name: "balanceOf",
					params: [{ name: "account", type: "sol_address" }],
					returns: "sol_int",
				}),
				method({ name: "totalSupply", params: [], returns: "sol_int" }),
				method({
					name: "allowance",
					params: [
						{ name: "owner", type: "sol_address" },
						{ name: "spender", type: "sol_address" },
					],
					returns: "sol_int",
				}),
			],
		}),
	],
	variables: [
		{ name: "user", type: "sol_address" },
		{ name: "threshold", type: "sol_int" },
	],
	types: [],
	functions: [],
	macros: [],
};

describe("expressionComplexity rule", () => {
	it("simple expression produces no diagnostic", () => {
		const checker = new SELChecker(TEST_SCHEMA, {
			rules: [expressionComplexity()],
		});
		const result = checker.check("1 + 2");

		expect(result.diagnostics).toHaveLength(0);
	});

	it("expression exceeding maxAstNodes triggers error", () => {
		const checker = new SELChecker(TEST_SCHEMA, {
			rules: [expressionComplexity({ maxAstNodes: 3 })],
		});

		/* "1 + 2 + 3 + 4" has many nodes (7+) */
		const result = checker.check("1 + 2 + 3 + 4");

		const msgs = result.diagnostics.map((d) => d.message);
		expect(msgs.some((m) => m.includes("AST node count"))).toBe(true);
		expect(result.diagnostics[0]?.severity).toBe("error");
	});

	it("deeply nested ternary triggers maxDepth", () => {
		const checker = new SELChecker(TEST_SCHEMA, {
			rules: [expressionComplexity({ maxDepth: 1 })],
		});

		/*
		 * root ternary at depth 0, inner ternary children at depth 1, leaf at depth 2
		 * maxDepth recorded will be 2, which exceeds limit of 1
		 */
		const result = checker.check("true ? (true ? 1 : 2) : 3");

		const msgs = result.diagnostics.map((d) => d.message);
		expect(msgs.some((m) => m.includes("nesting depth"))).toBe(true);
	});

	it("multiple contract calls trigger maxCalls", () => {
		const checker = new SELChecker(TEST_SCHEMA, {
			rules: [expressionComplexity({ maxCalls: 1 })],
		});

		/* Two contract calls */
		const result = checker.check("token.totalSupply() > token.totalSupply()");

		const msgs = result.diagnostics.map((d) => d.message);
		expect(msgs.some((m) => m.includes("contract calls"))).toBe(true);
	});

	it("many operators trigger maxOperators (&&/|| NOT counted)", () => {
		const checker = new SELChecker(TEST_SCHEMA, {
			rules: [expressionComplexity({ maxOperators: 2 })],
		});

		/* 3 arithmetic operators, 1 logical (&&) — && should NOT count */
		const result = checker.check("1 + 2 + 3 > 0 && true");

		const msgs = result.diagnostics.map((d) => d.message);
		expect(msgs.some((m) => m.includes("operators"))).toBe(true);
	});

	it("&&/|| are NOT counted as operators", () => {
		const checker = new SELChecker(TEST_SCHEMA, {
			rules: [expressionComplexity({ maxOperators: 2, maxBranches: 100 })],
		});

		/* Only && and ||, no other operators */
		const result = checker.check("true && false || true");

		const msgs = result.diagnostics.map((d) => d.message);
		expect(msgs.some((m) => m.includes("operators"))).toBe(false);
	});

	it("many branches (&&/||/ternary) trigger maxBranches", () => {
		const checker = new SELChecker(TEST_SCHEMA, {
			rules: [expressionComplexity({ maxBranches: 2 })],
		});

		/* 3 branches: &&, ||, ?: */
		const result = checker.check("true && false || (true ? 1 : 2) == 1");

		const msgs = result.diagnostics.map((d) => d.message);
		expect(msgs.some((m) => m.includes("branches"))).toBe(true);
	});

	it("multiple thresholds exceeded produces multiple diagnostics", () => {
		const checker = new SELChecker(TEST_SCHEMA, {
			rules: [
				expressionComplexity({
					maxAstNodes: 1,
					maxDepth: 0,
					maxOperators: 0,
				}),
			],
		});
		const result = checker.check("1 + 2");

		/* Should have diagnostics for nodes, depth, and operators */
		expect(result.diagnostics.length).toBeGreaterThanOrEqual(3);
	});

	it("custom thresholds override defaults", () => {
		/* With very high thresholds, nothing should trigger */
		const checker = new SELChecker(TEST_SCHEMA, {
			rules: [
				expressionComplexity({
					maxAstNodes: 1000,
					maxDepth: 1000,
					maxCalls: 1000,
					maxOperators: 1000,
					maxBranches: 1000,
				}),
			],
		});
		const result = checker.check(
			"token.totalSupply() > threshold && token.totalSupply() > 0",
		);

		expect(result.diagnostics).toHaveLength(0);
	});

	it("setting threshold to Infinity disables that metric", () => {
		const checker = new SELChecker(TEST_SCHEMA, {
			rules: [
				expressionComplexity({
					maxAstNodes: Infinity,
					maxDepth: Infinity,
					maxCalls: Infinity,
					maxOperators: Infinity,
					maxBranches: Infinity,
				}),
			],
		});

		/* Even a complex expression should produce no diagnostics */
		const result = checker.check(
			"token.totalSupply() > threshold && token.totalSupply() > 0",
		);

		expect(result.diagnostics).toHaveLength(0);
	});

	it("diagnostic message contains actual and limit values", () => {
		const checker = new SELChecker(TEST_SCHEMA, {
			rules: [expressionComplexity({ maxAstNodes: 3 })],
		});
		const result = checker.check("1 + 2 + 3 + 4");

		const nodeMsg = result.diagnostics.find((d) =>
			d.message.includes("AST node count"),
		);
		expect(nodeMsg).toBeDefined();

		/* Message should mention the actual count and the maximum */
		expect(nodeMsg?.message).toMatch(/\d+ exceeds maximum of 3/);
	});

	it("diagnostic spans full expression (from: 0, to: expression.length)", () => {
		const expr = "1 + 2 + 3 + 4";
		const checker = new SELChecker(TEST_SCHEMA, {
			rules: [expressionComplexity({ maxAstNodes: 3 })],
		});
		const result = checker.check(expr);

		const diag = result.diagnostics.find((d) =>
			d.message.includes("AST node count"),
		);
		expect(diag).toBeDefined();
		expect(diag?.from).toBe(0);
		expect(diag?.to).toBe(expr.length);
	});
});
