import { SELChecker } from "@seljs/checker";
import { buildSchema } from "@seljs/env";
import { createSEL } from "@seljs/runtime";
import { describe, expect, it } from "vitest";

import { buildRoutes, createE2EMockClient, routeFor } from "@/mock/index.js";

import type {
	AbiFixtureGroup,
	CompletionAssertion,
	ExpectedTypeAtAssertion,
	TestCase,
	TypeAtAssertion,
} from "./types.js";
import type { CompletionItem } from "@seljs/checker";
import type { TypeSchema } from "@seljs/schema";

/**
 * Auto-generate a test label from expr + expectedType when label is omitted.
 */
const labelFor = (tc: TestCase): string => {
	if (tc.label) {
		return tc.label;
	}

	if (tc.invalid) {
		return `${tc.expr} → INVALID`;
	}

	return `${tc.expr} → ${tc.expectedType}`;
};

/**
 * Extract labels from completion items — defined at module scope to avoid nested-callback depth.
 */
const getLabels = (items: CompletionItem[]): string[] =>
	items.map((item) => item.label);

/**
 * Type guard for struct TypeSchema entries.
 */
const isStructType = (t: TypeSchema): boolean => t.kind === "struct";

/**
 * Extract field names from a TypeSchema fields array.
 */
const getFieldNames = (fields: Array<{ name: string }>): string[] =>
	fields.map((f) => f.name);

/**
 * Find a struct type by name in a flat list.
 */
const findStructByName = (
	types: TypeSchema[],
	name: string,
): TypeSchema | undefined => {
	for (const t of types) {
		if (t.name === name) {
			return t;
		}
	}

	return undefined;
};

/**
 * Build a RouteMap from a mocks record keyed by function name.
 *
 * For each function name in `mocks`, finds which contract in the group owns
 * that function and creates the corresponding route entry.
 */
const buildRoutesFromMocks = (
	group: AbiFixtureGroup,
	mocks: Record<string, unknown>,
) => {
	const entries = Object.entries(mocks).map(([functionName, result]) => {
		// Find the contract that has this function in its ABI
		const entry = Object.entries(group.contracts).find(([, contract]) =>
			contract.abi.some(
				(item) => item.type === "function" && item.name === functionName,
			),
		);

		if (!entry) {
			throw new Error(
				`Mock function "${functionName}" not found in any contract ABI in group "${group.name}"`,
			);
		}

		const [, contract] = entry;

		return routeFor({
			abi: contract.abi,
			functionName,
			address: contract.address,
			result,
		});
	});

	return buildRoutes(...entries);
};

/**
 * Generate vitest describe/it blocks for an AbiFixtureGroup.
 *
 * Produces up to seven nested describe blocks (depth ≤ 3 from root):
 * - check: type-checks all valid (non-invalid) cases
 * - invalid: asserts that invalid cases fail type-checking
 * - evaluate: runs evaluation for cases with mocks
 * - completions: checks completionsAt for cases with completions
 * - typeAt: checks typeAt for cases with typeAt assertions
 * - expectedTypeAt: checks expectedTypeAt for cases with expectedTypeAt assertions
 * - schema: checks struct names and field counts at the group level
 */
const runFixtureGroup = (group: AbiFixtureGroup): void => {
	describe(group.name, () => {
		const schema = buildSchema({
			contracts: group.contracts,
			context: group.context,
		});

		const checkCases = group.cases.filter((c) => !c.invalid);

		if (checkCases.length > 0) {
			describe("check", () => {
				it.each(checkCases.map((c) => [labelFor(c), c] as [string, TestCase]))(
					"%s",
					(_, tc) => {
						const checker = new SELChecker(schema);
						const result = checker.check(tc.expr);
						expect(result.valid).toBe(true);
						expect(result.type).toBe(tc.expectedType);
					},
				);
			});
		}

		const invalidCases = group.cases.filter((c) => c.invalid);
		if (invalidCases.length > 0) {
			describe("invalid", () => {
				it.each(
					invalidCases.map((c) => [labelFor(c), c] as [string, TestCase]),
				)("%s", (_, tc) => {
					const checker = new SELChecker(schema);
					const result = checker.check(tc.expr);
					expect(result.valid).toBe(false);

					if (tc.minDiagnostics !== undefined) {
						expect(result.diagnostics.length).toBeGreaterThanOrEqual(
							tc.minDiagnostics,
						);
					}
				});
			});
		}

		const evaluateCases = group.cases.filter((c) => c.mocks);
		if (evaluateCases.length > 0) {
			describe("evaluate", () => {
				it.each(
					evaluateCases.map((c) => [labelFor(c), c] as [string, TestCase]),
				)("%s", async (_, tc) => {
					const routes = buildRoutesFromMocks(group, tc.mocks ?? {});
					const { client } = createE2EMockClient(routes);
					const env = createSEL({ schema, client });

					const result = await env.evaluate(tc.expr, tc.context);

					if (tc.expectedValue !== undefined) {
						expect(result.value).toEqual(tc.expectedValue);
					}

					if (tc.expectedRounds !== undefined) {
						expect(result.meta?.roundsExecuted).toBe(tc.expectedRounds);
					}
				});
			});
		}

		// Flatten to [testLabel_offset, tc, assertion] to avoid exceeding max-nested-callbacks.
		type CompletionRow = [string, TestCase, CompletionAssertion];
		const completionRows: CompletionRow[] = group.cases
			.filter((c) => c.completions && c.completions.length > 0)
			.flatMap((c) =>
				// eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- filtered above
				c.completions!.map(
					(a) =>
						[
							`${labelFor(c)} @ offset ${String(a.offset)}`,
							c,
							a,
						] as CompletionRow,
				),
			);

		if (completionRows.length > 0) {
			describe("completions", () => {
				it.each(completionRows)("%s", (_, tc, assertion) => {
					const checker = new SELChecker(schema);
					const info = checker.completionsAt(tc.expr, assertion.offset);
					const labels = getLabels(info.items);

					if (assertion.includes) {
						expect(labels).toEqual(expect.arrayContaining(assertion.includes));
					}

					if (assertion.excludes) {
						for (const label of assertion.excludes) {
							expect(labels).not.toContain(label);
						}
					}
				});
			});
		}

		type TypeAtRow = [string, TestCase, TypeAtAssertion];
		const typeAtRows: TypeAtRow[] = group.cases
			.filter((c) => c.typeAt && c.typeAt.length > 0)
			.flatMap((c) =>
				// eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- filtered above
				c.typeAt!.map(
					(a) =>
						[`${labelFor(c)} @ offset ${String(a.offset)}`, c, a] as TypeAtRow,
				),
			);

		if (typeAtRows.length > 0) {
			describe("typeAt", () => {
				it.each(typeAtRows)("%s", (_, tc, assertion) => {
					const checker = new SELChecker(schema);
					const result = checker.typeAt(tc.expr, assertion.offset);
					expect(result?.type).toBe(assertion.type);
				});
			});
		}

		type ExpectedTypeAtRow = [string, TestCase, ExpectedTypeAtAssertion];
		const expectedTypeAtRows: ExpectedTypeAtRow[] = group.cases
			.filter((c) => c.expectedTypeAt && c.expectedTypeAt.length > 0)
			.flatMap((c) =>
				// eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- filtered above
				c.expectedTypeAt!.map(
					(a) =>
						[
							`${labelFor(c)} @ offset ${String(a.offset)}`,
							c,
							a,
						] as ExpectedTypeAtRow,
				),
			);

		if (expectedTypeAtRows.length > 0) {
			describe("expectedTypeAt", () => {
				it.each(expectedTypeAtRows)("%s", (_, tc, assertion) => {
					const checker = new SELChecker(schema);
					const result = checker.expectedTypeAt(tc.expr, assertion.offset);
					expect(result?.expectedType).toBe(assertion.expectedType);
					if (assertion.context !== undefined) {
						expect(result?.context).toBe(assertion.context);
					}
				});
			});
		}

		if (group.schema?.structs && group.schema.structs.length > 0) {
			// Capture for use inside callbacks without non-null assertions.
			const schemaStructs = group.schema.structs;
			describe("schema", () => {
				it("struct assertions", () => {
					const selSchema = schema;
					const structTypes = selSchema.types.filter(isStructType);

					for (const assertion of schemaStructs) {
						const found = findStructByName(structTypes, assertion.name);
						expect(found, `struct "${assertion.name}" not found`).toBeDefined();
						expect(
							found?.fields?.length,
							`struct "${assertion.name}" field count`,
						).toBe(assertion.fieldCount);

						if (assertion.fields) {
							const fieldNames = getFieldNames(found?.fields ?? []);
							expect(
								fieldNames,
								`struct "${assertion.name}" missing fields`,
							).toEqual(expect.arrayContaining(assertion.fields));
						}
					}
				});
			});
		}
	});
};

/**
 * Run multiple fixture groups sequentially.
 *
 * Each group produces its own top-level `describe` block via {@link runFixtureGroup}.
 */
export const runFixtureGroups = (groups: AbiFixtureGroup[]): void => {
	for (const group of groups) {
		runFixtureGroup(group);
	}
};
