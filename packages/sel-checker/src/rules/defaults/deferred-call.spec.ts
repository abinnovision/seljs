import { describe, expect, it } from "vitest";

import { deferredCall } from "./deferred-call.js";
import { SELChecker } from "../../checker/checker.js";

import type { MethodSchema, SELSchema } from "@seljs/schema";

const method = (m: Omit<MethodSchema, "abi">): MethodSchema =>
	m as MethodSchema;

const SCHEMA: SELSchema = {
	version: "1.0.0",
	contracts: [
		{
			name: "usdc",
			address: "0x1111111111111111111111111111111111111111",
			methods: [
				method({
					name: "balanceOf",
					params: [{ name: "account", type: "sol_address" }],
					returns: "sol_int",
				}),
				method({
					name: "f",
					params: [{ name: "x", type: "sol_int" }],
					returns: "sol_int",
				}),
			],
		},
		{
			name: "aToken",
			address: "0x2222222222222222222222222222222222222222",
			methods: [],
		},
	],
	variables: [
		{ name: "data", type: "bytes" },
		{ name: "n", type: "int" },
	],
	types: [],
	functions: [],
	macros: [],
};

const diagnose = (expression: string) =>
	new SELChecker(SCHEMA, { rules: [deferredCall] }).check(expression)
		.diagnostics;

describe("src/rules/defaults/deferred-call.ts", () => {
	it("flags arguments that depend on comprehension variables", () => {
		expect(diagnose("[1, 2].map(i, usdc.f(i))")).toHaveLength(1);
	});

	it("treats contract addresses as resolvable", () => {
		expect(diagnose("usdc.balanceOf(aToken.address)")).toEqual([]);
	});

	it("treats builtin block fields as resolvable", () => {
		expect(diagnose("usdc.f(block.number)")).toEqual([]);
		expect(diagnose("usdc.f(block.timestamp)")).toEqual([]);
	});

	it("flags solInt() over a bytes variable", () => {
		expect(diagnose("usdc.f(solInt(data))")).toHaveLength(1);
	});

	it("treats solInt() over an int variable as resolvable", () => {
		expect(diagnose("usdc.f(solInt(n))")).toEqual([]);
	});
});
