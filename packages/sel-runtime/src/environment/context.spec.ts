import { describe, expect, it, vi } from "vitest";

import { normalizeContextForEvaluation } from "./context.js";

import type { CelCodecRegistry } from "@seljs/checker";

const createMockCodecRegistry = () => {
	const parse = vi.fn((value: unknown) => value);
	const resolve = vi.fn(() => ({ parse }));

	return {
		registry: { resolve } as unknown as CelCodecRegistry,
		resolve,
		parse,
	};
};

describe("src/environment/context.ts", () => {
	it("resolves codec and parses value when type is found in variableTypes", () => {
		const { registry, resolve, parse } = createMockCodecRegistry();
		const context = { amount: 100n };
		const variableTypes = new Map([["amount", "uint256"]]);

		const result = normalizeContextForEvaluation(
			context,
			variableTypes,
			registry,
		);

		expect(resolve).toHaveBeenCalledWith("uint256");
		expect(parse).toHaveBeenCalledWith(100n);
		expect(result).toEqual({ amount: 100n });
	});

	it("falls back to dyn codec when type is missing from variableTypes", () => {
		const { registry, resolve, parse } = createMockCodecRegistry();
		const context = { unknown_var: "hello" };
		const variableTypes = new Map<string, string>();

		const result = normalizeContextForEvaluation(
			context,
			variableTypes,
			registry,
		);

		expect(resolve).toHaveBeenCalledWith("dyn");
		expect(parse).toHaveBeenCalledWith("hello");
		expect(result).toEqual({ unknown_var: "hello" });
	});

	it("returns empty object for empty context", () => {
		const { registry } = createMockCodecRegistry();
		const result = normalizeContextForEvaluation({}, new Map(), registry);

		expect(result).toEqual({});
	});

	it("handles multiple variables with different types", () => {
		const { registry, resolve, parse } = createMockCodecRegistry();
		const context = { amount: 100n, owner: "0xabc", flag: true };
		const variableTypes = new Map([
			["amount", "uint256"],
			["owner", "address"],
		]);

		const result = normalizeContextForEvaluation(
			context,
			variableTypes,
			registry,
		);

		expect(resolve).toHaveBeenCalledWith("uint256");
		expect(resolve).toHaveBeenCalledWith("address");

		// flag has no type
		expect(resolve).toHaveBeenCalledWith("dyn");
		expect(parse).toHaveBeenCalledTimes(3);
		expect(result).toEqual({ amount: 100n, owner: "0xabc", flag: true });
	});
});
