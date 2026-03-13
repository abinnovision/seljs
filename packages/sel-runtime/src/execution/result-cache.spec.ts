import { beforeEach, describe, expect, it } from "vitest";

import { ResultCache } from "./result-cache.js";

describe("src/execution/result-cache.ts", () => {
	let cache: ResultCache;

	beforeEach(() => {
		cache = new ResultCache();
	});

	describe("set and get", () => {
		it("stores and retrieves a value", () => {
			cache.set("id1", 42n);
			expect(cache.get("id1")).toBe(42n);
		});

		it("returns undefined for non-existent key", () => {
			expect(cache.get("nonexistent")).toBeUndefined();
		});
	});

	describe("has", () => {
		it("returns false before set", () => {
			expect(cache.has("id1")).toBe(false);
		});

		it("returns true after set", () => {
			cache.set("id1", 42n);
			expect(cache.has("id1")).toBe(true);
		});
	});

	describe("clear", () => {
		it("removes all entries", () => {
			cache.set("id1", 42n);
			cache.set("id2", 100n);
			cache.clear();
			expect(cache.has("id1")).toBe(false);
			expect(cache.has("id2")).toBe(false);
		});
	});

	describe("generateCallId", () => {
		it("produces deterministic ID for same contract+method+args", () => {
			const id1 = cache.generateCallId("token", "balanceOf", ["0x1"]);
			const id2 = cache.generateCallId("token", "balanceOf", ["0x1"]);
			expect(id1).toBe(id2);
		});

		it("produces different ID for different args", () => {
			const id1 = cache.generateCallId("token", "balanceOf", ["0x1"]);
			const id2 = cache.generateCallId("token", "balanceOf", ["0x2"]);
			expect(id1).not.toBe(id2);
		});

		it("produces different ID for different methods", () => {
			const id1 = cache.generateCallId("token", "balanceOf", []);
			const id2 = cache.generateCallId("token", "totalSupply", []);
			expect(id1).not.toBe(id2);
		});

		it("handles bigint arguments", () => {
			const id = cache.generateCallId("token", "transfer", [1n, 2n]);
			expect(id).toContain("1n");
			expect(id).toContain("2n");
		});

		it("object key ordering does not affect the ID", () => {
			const id1 = cache.generateCallId("c", "m", [{ b: 1, a: 2 }]);
			const id2 = cache.generateCallId("c", "m", [{ a: 2, b: 1 }]);
			expect(id1).toBe(id2);
		});

		it("bigint produces distinct key from same number", () => {
			const idBigint = cache.generateCallId("c", "m", [42n]);
			const idNumber = cache.generateCallId("c", "m", [42]);
			expect(idBigint).not.toBe(idNumber);
		});

		it("same input always produces same output", () => {
			const id1 = cache.generateCallId("vault", "deposit", [
				{ amount: 100n, token: "0xabc" },
			]);
			const id2 = cache.generateCallId("vault", "deposit", [
				{ amount: 100n, token: "0xabc" },
			]);
			expect(id1).toBe(id2);
		});
	});
});
