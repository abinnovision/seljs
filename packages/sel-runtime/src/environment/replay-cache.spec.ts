import { describe, expect, it, vi } from "vitest";

import {
	buildExecutionReplayCache,
	createReplayCallId,
} from "./replay-cache.js";

import type { CallArgument, CollectedCall } from "../analysis/types.js";
import type { CelCodecRegistry } from "@seljs/checker";

const createMockCodecRegistry = () => {
	const encode = vi.fn((_type: string, val: unknown) => val);

	return { encode } as unknown as CelCodecRegistry;
};

const makeCall = (
	id: string,
	contract: string,
	method: string,
	args: CallArgument[],
): CollectedCall => ({
	id,
	contract,
	method,
	args,
	astNode: null,
});

describe("src/environment/replay-cache.ts", () => {
	describe("createReplayCallId", () => {
		it("produces contract:method:arg1,arg2 format", () => {
			expect(createReplayCallId("erc20", "balanceOf", ["0xabc", 100n])).toBe(
				"erc20:balanceOf:0xabc,100",
			);
		});

		it("produces contract:method: for empty args", () => {
			expect(createReplayCallId("erc20", "totalSupply", [])).toBe(
				"erc20:totalSupply:",
			);
		});
	});

	describe("buildExecutionReplayCache", () => {
		it("resolves literal args via codecRegistry.encode", () => {
			const codec = createMockCodecRegistry();
			const calls = [
				makeCall("c1", "erc20", "balanceOf", [
					{ type: "literal", value: "0xabc" },
				]),
			];
			const results = new Map([["c1", 100n]]);
			const getParamTypes = vi.fn(() => ["address"]);

			const cache = buildExecutionReplayCache(
				calls,
				results,
				{},
				codec,
				getParamTypes,
			);

			expect(codec.encode).toHaveBeenCalledWith("address", "0xabc");
			expect(cache.get("erc20:balanceOf:0xabc")).toBe(100n);
		});

		it("resolves variable args from variables map", () => {
			const codec = createMockCodecRegistry();
			const calls = [
				makeCall("c1", "erc20", "balanceOf", [
					{ type: "variable", variableName: "user" },
				]),
			];
			const results = new Map([["c1", 50n]]);
			const variables = { user: "0xdef" };
			const getParamTypes = vi.fn(() => ["address"]);

			const cache = buildExecutionReplayCache(
				calls,
				results,
				variables,
				codec,
				getParamTypes,
			);

			expect(codec.encode).toHaveBeenCalledWith("address", "0xdef");
			expect(cache.get("erc20:balanceOf:0xdef")).toBe(50n);
		});

		it("resolves call_result args from results map", () => {
			const codec = createMockCodecRegistry();
			const calls = [
				makeCall("c2", "vault", "deposit", [
					{ type: "call_result", dependsOnCallId: "c1" },
				]),
			];
			const results = new Map<string, unknown>([
				["c1", 100n],
				["c2", "ok"],
			]);
			const getParamTypes = vi.fn(() => ["uint256"]);

			const cache = buildExecutionReplayCache(
				calls,
				results,
				{},
				codec,
				getParamTypes,
			);

			expect(codec.encode).toHaveBeenCalledWith("uint256", 100n);
			expect(cache.get("vault:deposit:100")).toBe("ok");
		});

		it("returns undefined for missing variable name", () => {
			const codec = createMockCodecRegistry();
			const calls = [
				makeCall("c1", "erc20", "balanceOf", [
					// no variableName
					{ type: "variable" },
				]),
			];
			const results = new Map([["c1", 0n]]);
			const getParamTypes = vi.fn(() => ["address"]);

			const cache = buildExecutionReplayCache(
				calls,
				results,
				{},
				codec,
				getParamTypes,
			);

			// The arg resolves to undefined since variableName is missing
			expect(cache.get("erc20:balanceOf:undefined")).toBe(0n);
		});

		it("returns undefined for missing call dependency ID", () => {
			const codec = createMockCodecRegistry();
			const calls = [
				makeCall("c1", "vault", "deposit", [
					// no dependsOnCallId
					{ type: "call_result" },
				]),
			];
			const results = new Map([["c1", "ok"]]);
			const getParamTypes = vi.fn(() => ["uint256"]);

			const cache = buildExecutionReplayCache(
				calls,
				results,
				{},
				codec,
				getParamTypes,
			);

			expect(cache.get("vault:deposit:undefined")).toBe("ok");
		});

		it("falls back to dyn when paramTypes entry is missing", () => {
			const codec = createMockCodecRegistry();
			const calls = [
				makeCall("c1", "erc20", "balanceOf", [
					{ type: "literal", value: "0xabc" },
				]),
			];
			const results = new Map([["c1", 100n]]);

			// empty param types
			const getParamTypes = vi.fn(() => []);

			buildExecutionReplayCache(calls, results, {}, codec, getParamTypes);

			expect(codec.encode).toHaveBeenCalledWith("dyn", "0xabc");
		});

		it("builds correct cache key via createReplayCallId", () => {
			const codec = createMockCodecRegistry();
			const calls = [
				makeCall("c1", "erc20", "transfer", [
					{ type: "literal", value: "0xabc" },
					{ type: "literal", value: 100n },
				]),
			];
			const results = new Map([["c1", true]]);
			const getParamTypes = vi.fn(() => ["address", "uint256"]);

			const cache = buildExecutionReplayCache(
				calls,
				results,
				{},
				codec,
				getParamTypes,
			);

			expect(cache.has("erc20:transfer:0xabc,100")).toBe(true);
			expect(cache.get("erc20:transfer:0xabc,100")).toBe(true);
		});
	});
});
