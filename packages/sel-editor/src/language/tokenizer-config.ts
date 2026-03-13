import type { SELSchema } from "@seljs/schema";

export interface TokenizerConfig {
	contractNames: Set<string>;
	functionNames: Set<string>;
	macroNames: Set<string>;
	variableNames: Set<string>;
}

export const createTokenizerConfig = (schema: SELSchema): TokenizerConfig => ({
	contractNames: new Set(schema.contracts.map((c) => c.name)),
	functionNames: new Set(schema.functions.map((f) => f.name)),
	macroNames: new Set(schema.macros.map((m) => m.name)),
	variableNames: new Set(schema.variables.map((v) => v.name)),
});
