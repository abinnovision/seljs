import type { AbiFixtureGroup } from "./types.js";

/**
 * Identity helper that provides type inference for fixture group definitions.
 *
 * Avoids the need to import and annotate `AbiFixtureGroup` in every fixture file.
 */
export const defineFixtureGroup = (group: AbiFixtureGroup): AbiFixtureGroup =>
	group;
