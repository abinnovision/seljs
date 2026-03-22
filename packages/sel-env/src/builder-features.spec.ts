import { describe, expect, it, beforeEach } from "vitest";

import { buildSchema } from "./builder.js";
import { registerFeature } from "./feature-registry.js";

import type { SELFeatureDefinition } from "@seljs/schema";

const MOCK_FEATURE: SELFeatureDefinition = {
	name: "mockFeature",
	description: "A mock feature for testing",
	variables: [
		{ name: "featureVar", type: "sol_int", description: "Feature variable" },
	],
	functions: [
		{
			name: "featureFn",
			signature: "featureFn(): bool",
			params: [],
			returns: "bool",
			description: "Feature function",
		},
	],
	types: [
		{
			name: "FeatureType",
			kind: "primitive",
			description: "Feature type",
		},
	],
};

describe("buildSchema — features", () => {
	beforeEach(() => {
		registerFeature(MOCK_FEATURE);
	});

	it("returns identical schema when no features config is provided", () => {
		const withoutFeatures = buildSchema({});

		// Should have no feature variables or functions
		expect(
			withoutFeatures.variables.find((v) => v.name === "featureVar"),
		).toBeUndefined();
		expect(
			withoutFeatures.functions.find((f) => f.name === "featureFn"),
		).toBeUndefined();
	});

	it("returns identical schema when features config is empty", () => {
		const schema = buildSchema({ features: {} });
		expect(
			schema.variables.find((v) => v.name === "featureVar"),
		).toBeUndefined();
		expect(
			schema.functions.find((f) => f.name === "featureFn"),
		).toBeUndefined();
	});

	it("does not merge disabled features", () => {
		const schema = buildSchema({ features: { mockFeature: false } });
		expect(
			schema.variables.find((v) => v.name === "featureVar"),
		).toBeUndefined();
		expect(
			schema.functions.find((f) => f.name === "featureFn"),
		).toBeUndefined();
	});

	it("merges enabled feature variables into schema with feature tag", () => {
		const schema = buildSchema({ features: { mockFeature: true } });
		const featureVar = schema.variables.find((v) => v.name === "featureVar");
		expect(featureVar).toBeDefined();
		expect(featureVar?.type).toBe("sol_int");
		expect(featureVar?.feature).toBe("mockFeature");
	});

	it("merges enabled feature functions into schema with feature tag", () => {
		const schema = buildSchema({ features: { mockFeature: true } });
		const featureFn = schema.functions.find((f) => f.name === "featureFn");
		expect(featureFn).toBeDefined();
		expect(featureFn?.returns).toBe("bool");
		expect(featureFn?.feature).toBe("mockFeature");
	});

	it("merges enabled feature types into schema with feature tag", () => {
		const schema = buildSchema({ features: { mockFeature: true } });
		const featureType = schema.types.find((t) => t.name === "FeatureType");
		expect(featureType).toBeDefined();
		expect(featureType?.feature).toBe("mockFeature");
	});

	it("does not merge features set to false", () => {
		const schema = buildSchema({
			features: { mockFeature: false },
		});
		const featureVar = schema.variables.find((v) => v.name === "featureVar");
		expect(featureVar).toBeUndefined();
	});

	it("silently ignores unknown feature names", () => {
		const schema = buildSchema({ features: { unknownFeature: true } });

		// Should not throw, just produce a normal schema
		expect(schema.version).toBe("1.0.0");
	});

	it("context variables take precedence over feature variables", () => {
		const schema = buildSchema({
			context: { featureVar: "sol_address" },
			features: { mockFeature: true },
		});

		// User's context variable should win
		const vars = schema.variables.filter((v) => v.name === "featureVar");
		expect(vars).toHaveLength(1);
		expect(vars[0]?.type).toBe("sol_address");
	});

	it("sets enabledFeatures for enabled features only", () => {
		const schema = buildSchema({ features: { mockFeature: true } });
		expect(schema.enabledFeatures).toEqual(["mockFeature"]);
	});

	it("does not set enabledFeatures when no features are enabled", () => {
		const schema = buildSchema({});
		expect(schema.enabledFeatures).toBeUndefined();
	});

	it("does not include disabled features in enabledFeatures", () => {
		const schema = buildSchema({ features: { mockFeature: false } });
		expect(schema.enabledFeatures).toBeUndefined();
	});
});
