import type { CelCodecRegistry } from "@seljs/checker";

export const normalizeContextForEvaluation = (
	context: Record<string, unknown>,
	variableTypes: Map<string, string>,
	codecRegistry: CelCodecRegistry,
): Record<string, unknown> => {
	const normalized: Record<string, unknown> = {};

	for (const [key, value] of Object.entries(context)) {
		const type = variableTypes.get(key);
		normalized[key] = codecRegistry.resolve(type ?? "dyn").parse(value);
	}

	return normalized;
};
