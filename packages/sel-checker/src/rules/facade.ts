import {
	deferredCall,
	expressionComplexity,
	noConstantCondition,
	noMixedOperators,
	noRedundantBool,
	noSelfComparison,
	requireType,
} from "./defaults/index.js";

/**
 * Unified export for rules.
 *
 * Provides access to individual built-in rules, a convenience array of all
 * built-in rules, and rule factories for custom enforcement.
 */
export const rules = {
	/** All built-in lint rules. */
	builtIn: [
		noRedundantBool,
		noConstantCondition,
		noMixedOperators,
		noSelfComparison,
		deferredCall,
	],

	/** Flags redundant comparisons to boolean literals (true/false). */
	noRedundantBool,

	/** Flags constant conditions (e.g. `true && x`, `1 == 1`). */
	noConstantCondition,

	/** Requires parentheses when mixing `&&` and `||`. */
	noMixedOperators,

	/** Flags self-comparisons (e.g. `x == x`). */
	noSelfComparison,

	/** Flags contract calls with dynamic arguments that will execute as live RPC calls. */
	deferredCall,

	/** Rule factory that enforces an expression evaluates to the expected CEL type. */
	requireType,

	/** Factory that enforces expression complexity thresholds. */
	expressionComplexity,
} as const;
