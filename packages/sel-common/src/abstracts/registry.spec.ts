import { describe, expect, it } from "vitest";

import { Registry } from "./registry.js";

interface TestConfig {
	value: string;
}

interface TestEntry {
	name: string;
	value: string;
}

class TestRegistry extends Registry<TestConfig, TestEntry> {
	public register(name: string, config: TestConfig): this {
		this.entries.set(name, { name, value: config.value });

		return this;
	}
}

describe("src/abstracts/registry.ts", () => {
	it("should register and retrieve an entry", () => {
		const registry = new TestRegistry();
		registry.register("test", { value: "hello" });

		const entry = registry.get("test");
		expect(entry).toEqual({ name: "test", value: "hello" });
	});

	it("should return undefined for unknown entries", () => {
		const registry = new TestRegistry();
		expect(registry.get("unknown")).toBeUndefined();
	});

	it("should check entry existence with has()", () => {
		const registry = new TestRegistry();
		registry.register("test", { value: "hello" });

		expect(registry.has("test")).toBe(true);
		expect(registry.has("unknown")).toBe(false);
	});

	it("should return all entries with getAll()", () => {
		const registry = new TestRegistry();
		registry.register("a", { value: "1" });
		registry.register("b", { value: "2" });

		const entries = registry.getAll();
		expect(entries).toHaveLength(2);
		expect(entries).toEqual(
			expect.arrayContaining([
				{ name: "a", value: "1" },
				{ name: "b", value: "2" },
			]),
		);
	});

	it("should return empty array when no entries registered", () => {
		const registry = new TestRegistry();
		expect(registry.getAll()).toEqual([]);
	});

	it("should overwrite entry on duplicate key registration", () => {
		const registry = new TestRegistry();
		registry.register("test", { value: "first" });
		registry.register("test", { value: "second" });

		const entry = registry.get("test");
		expect(entry).toEqual({ name: "test", value: "second" });
		expect(registry.getAll()).toHaveLength(1);
	});

	it("should support method chaining from register()", () => {
		const registry = new TestRegistry();
		const result = registry
			.register("a", { value: "1" })
			.register("b", { value: "2" });

		expect(result).toBe(registry);
		expect(registry.getAll()).toHaveLength(2);
	});
});
