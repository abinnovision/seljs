import type { SELFeatureDefinition } from "@seljs/schema";

/**
 * Internal registry of known feature definitions.
 * Feature definitions describe what a feature contributes to the schema (variables, functions, types).
 * This registry is NOT exported from the package — it is internal to @seljs/env.
 */
const FEATURE_REGISTRY = new Map<string, SELFeatureDefinition>();

/**
 * Retrieves a feature definition by name from the internal registry.
 */
export const getFeatureDefinition = (
	name: string,
): SELFeatureDefinition | undefined => FEATURE_REGISTRY.get(name);

/**
 * Returns the names of all registered features.
 */
export const getAvailableFeatureNames = (): string[] => [
	...FEATURE_REGISTRY.keys(),
];

/**
 * Registers a feature definition in the internal registry.
 * Used by feature modules within the library to declare their schema contributions.
 */
export const registerFeature = (definition: SELFeatureDefinition): void => {
	FEATURE_REGISTRY.set(definition.name, definition);
};
