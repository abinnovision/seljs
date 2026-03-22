import { describe, expect, it, beforeEach } from "vitest";

import {
	getAvailableFeatureNames,
	getFeatureDefinition,
	registerFeature,
} from "./feature-registry.js";

import type { SELFeatureDefinition } from "@seljs/schema";

const TEST_FEATURE: SELFeatureDefinition = {
	name: "testFeature",
	description: "A test feature",
	variables: [{ name: "testVar", type: "sol_int" }],
	functions: [
		{
			name: "testFn",
			signature: "testFn(): sol_int",
			params: [],
			returns: "sol_int",
		},
	],
};

describe("feature-registry", () => {
	beforeEach(() => {
		// Register the test feature for each test
		registerFeature(TEST_FEATURE);
	});

	describe("registerFeature", () => {
		it("registers a feature definition", () => {
			const result = getFeatureDefinition("testFeature");
			expect(result).toEqual(TEST_FEATURE);
		});

		it("overwrites an existing feature with the same name", () => {
			const updated: SELFeatureDefinition = {
				...TEST_FEATURE,
				description: "Updated",
			};
			registerFeature(updated);
			expect(getFeatureDefinition("testFeature")?.description).toBe("Updated");
		});
	});

	describe("getFeatureDefinition", () => {
		it("returns undefined for unknown feature", () => {
			expect(getFeatureDefinition("nonexistent")).toBeUndefined();
		});

		it("returns the registered definition", () => {
			expect(getFeatureDefinition("testFeature")).toBeDefined();
			expect(getFeatureDefinition("testFeature")?.name).toBe("testFeature");
		});
	});

	describe("getAvailableFeatureNames", () => {
		it("includes registered feature names", () => {
			expect(getAvailableFeatureNames()).toContain("testFeature");
		});
	});
});
