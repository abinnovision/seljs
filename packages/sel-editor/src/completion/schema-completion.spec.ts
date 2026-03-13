import { CompletionContext } from "@codemirror/autocomplete";
import { EditorState } from "@codemirror/state";
import { celLanguageSupport } from "@seljs/cel-lezer";
import { SELChecker } from "@seljs/checker";
import { describe, expect, it } from "vitest";

import { SchemaCompletionProvider } from "./schema-completion";

import type { SELSchema } from "@seljs/schema";

// --- Test Schema ---

const testSchema = {
	version: "1.0.0",
	contracts: [
		{
			name: "erc20",
			methods: [
				{
					name: "balanceOf",
					params: [{ name: "owner", type: "sol_address" }],
					returns: "sol_int",
				},
				{
					name: "totalSupply",
					params: [],
					returns: "sol_int",
				},
			],
		},
		{
			name: "vault",
			methods: [
				{
					name: "deposit",
					params: [{ name: "amount", type: "sol_int" }],
					returns: "bool",
				},
			],
		},
	],
	variables: [
		{
			name: "user",
			type: "sol_address",
			description: "The wallet address",
		},
		{ name: "blockNumber", type: "sol_int" },
	],
	types: [
		{ name: "sol_address", kind: "primitive" },
		{ name: "sol_int", kind: "primitive" },
		{
			name: "TokenInfo",
			kind: "struct",
			fields: [
				{ name: "symbol", type: "string" },
				{ name: "decimals", type: "sol_int" },
			],
		},
	],
	functions: [
		{
			name: "size",
			signature: "size(list|map|string): int",
			params: [{ name: "value", type: "any" }],
			returns: "int",
		},
		{
			name: "has",
			signature: "has(object.field): bool",
			params: [{ name: "field", type: "any" }],
			returns: "bool",
		},
	],
	macros: [
		{
			name: "all",
			pattern: "list.all(x, predicate)",
			description: "Returns true if all elements satisfy the predicate",
		},
		{
			name: "filter",
			pattern: "list.filter(x, predicate)",
		},
	],
} as unknown as SELSchema;

// --- Helpers ---

function complete(
	text: string,
	pos: number,
	schema: SELSchema,
	explicit = false,
	checker?: SELChecker,
) {
	const actualChecker = checker ?? new SELChecker(schema);
	const provider = new SchemaCompletionProvider(schema, actualChecker);
	const state = EditorState.create({
		doc: text,
		extensions: [celLanguageSupport()],
	});
	const context = new CompletionContext(state, pos, explicit);

	return provider.completionSource(context);
}

function labels(result: ReturnType<typeof complete>): string[] {
	return result?.options.map((o) => o.label) ?? [];
}

// --- Tests ---

describe("src/completion/schema-completion.ts", () => {
	describe("schemaCompletionProvider", () => {
		describe("top-level completions", () => {
			it("suggests contract names when typing a prefix", () => {
				const result = complete("erc", 3, testSchema);
				expect(labels(result)).toContain("erc20");
			});

			it("suggests variable names when typing a prefix", () => {
				const result = complete("us", 2, testSchema);
				expect(labels(result)).toContain("user");
			});

			it("suggests function names when typing a prefix", () => {
				const result = complete("si", 2, testSchema);
				expect(labels(result)).toContain("size");
			});

			it("includes true/false/null in top-level completions", () => {
				const result = complete("t", 1, testSchema);
				const opts = labels(result);
				expect(opts).toContain("true");
			});

			it("returns all top-level options on explicit activation", () => {
				const result = complete("", 0, testSchema, true);
				const opts = labels(result);
				expect(opts).toContain("erc20");
				expect(opts).toContain("vault");
				expect(opts).toContain("user");
				expect(opts).toContain("size");
				expect(opts).toContain("true");
			});

			it("returns null without explicit activation and no word", () => {
				const result = complete("", 0, testSchema, false);
				expect(result).toBeNull();
			});
		});

		describe("dot-access completions (known contract)", () => {
			it("suggests methods of a known contract after dot", () => {
				const result = complete("erc20.", 6, testSchema);
				const opts = labels(result);
				expect(opts).toContain("balanceOf");
				expect(opts).toContain("totalSupply");
			});

			it("narrows to specific contract methods", () => {
				const result = complete("erc20.", 6, testSchema);
				const opts = labels(result);

				// Should NOT include vault methods
				expect(opts).not.toContain("deposit");
			});

			it("includes method signatures in detail", () => {
				const result = complete("erc20.", 6, testSchema);
				const balanceOf = result?.options.find((o) => o.label === "balanceOf");
				expect(balanceOf?.detail).toBe("(owner: sol_address): sol_int");
			});

			it("filters methods when typing after dot", () => {
				const result = complete("erc20.bal", 9, testSchema);
				expect(result).not.toBeNull();

				// completion starts after the dot
				expect(result!.from).toBe(6);
			});
		});

		describe("dot-access completions (unknown identifier)", () => {
			it("suggests all methods + macros + struct fields for unknown identifier", () => {
				const result = complete("foo.", 4, testSchema);
				const opts = labels(result);

				// Methods from all contracts
				expect(opts).toContain("balanceOf");
				expect(opts).toContain("deposit");

				// Macros
				expect(opts).toContain("all");
				expect(opts).toContain("filter");

				// Struct fields
				expect(opts).toContain("symbol");
				expect(opts).toContain("decimals");
			});

			it("filters broad completions when typing after dot", () => {
				const result = complete("foo.ba", 6, testSchema);
				expect(result).not.toBeNull();

				// after "foo."
				expect(result!.from).toBe(4);
			});
		});

		describe("completion metadata", () => {
			it("contract completions have type 'class'", () => {
				const result = complete("erc", 3, testSchema);
				const erc20 = result?.options.find((o) => o.label === "erc20");
				expect(erc20?.type).toBe("class");
			});

			it("variable completions have type 'variable'", () => {
				const result = complete("us", 2, testSchema);
				const user = result?.options.find((o) => o.label === "user");
				expect(user?.type).toBe("variable");
			});

			it("function completions have type 'function'", () => {
				const result = complete("si", 2, testSchema);
				const size = result?.options.find((o) => o.label === "size");
				expect(size?.type).toBe("function");
			});

			it("method completions have type 'method'", () => {
				const result = complete("erc20.", 6, testSchema);
				const balanceOf = result?.options.find((o) => o.label === "balanceOf");
				expect(balanceOf?.type).toBe("method");
			});

			it("variable completions include type info in detail", () => {
				const result = complete("us", 2, testSchema);
				const user = result?.options.find((o) => o.label === "user");
				expect(user?.detail).toBe("sol_address");
			});

			it("variable completions include description in info", () => {
				const result = complete("us", 2, testSchema);
				const user = result?.options.find((o) => o.label === "user");
				expect(user?.info).toBe("The wallet address");
			});

			it("function completions include signature in detail", () => {
				const result = complete("si", 2, testSchema);
				const size = result?.options.find((o) => o.label === "size");
				expect(size?.detail).toBe("size(list|map|string): int");
			});
		});

		describe("edge cases", () => {
			it("empty schema produces no completions", () => {
				const emptySchema: SELSchema = {
					version: "1.0.0",
					contracts: [],
					variables: [],
					types: [],
					functions: [],
					macros: [],
				};
				const result = complete("x", 1, emptySchema);

				// Only atoms (true/false/null) from the provider
				const opts = labels(result);
				expect(opts).toEqual(["true", "false", "null"]);
			});

			it("schema with only contracts still provides contract completions", () => {
				const contractOnly = {
					version: "1.0.0",
					contracts: [{ name: "myToken", methods: [] }],
					variables: [],
					types: [],
					functions: [],
					macros: [],
				} as unknown as SELSchema;
				const result = complete("my", 2, contractOnly);
				expect(labels(result)).toContain("myToken");
			});

			it("skips dot completion for numeric identifiers", () => {
				const result = complete("3.14", 4, testSchema);

				/*
				 * Should fall through to word completion, not dot completion
				 * "14" matches word completion → returns top-level options
				 */
				expect(result).not.toBeNull();
			});

			it("handles schema update by re-creating provider", () => {
				const schemaA = {
					version: "1.0.0",
					contracts: [{ name: "tokenA", methods: [] }],
					variables: [],
					types: [],
					functions: [],
					macros: [],
				} as unknown as SELSchema;
				const schemaB = {
					version: "1.0.0",
					contracts: [{ name: "tokenB", methods: [] }],
					variables: [],
					types: [],
					functions: [],
					macros: [],
				} as unknown as SELSchema;

				const resultA = complete("tok", 3, schemaA);
				const resultB = complete("tok", 3, schemaB);

				expect(labels(resultA)).toContain("tokenA");
				expect(labels(resultA)).not.toContain("tokenB");
				expect(labels(resultB)).toContain("tokenB");
				expect(labels(resultB)).not.toContain("tokenA");
			});
		});

		describe("struct completions with checker", () => {
			const structSchema = {
				version: "1.0.0",
				contracts: [
					{
						name: "pool",
						methods: [
							{
								name: "getPool",
								params: [{ name: "id", type: "sol_int" }],
								returns: "SEL_Struct_pool_getPool",
							},
							{
								name: "totalLiquidity",
								params: [],
								returns: "sol_int",
							},
						],
					},
				],
				variables: [],
				types: [
					{
						name: "SEL_Struct_pool_getPool",
						kind: "struct",
						fields: [
							{ name: "token", type: "sol_address" },
							{ name: "balance", type: "sol_int" },
						],
					},
				],
				functions: [],
				macros: [
					{
						name: "all",
						pattern: "list.all(x, predicate)",
					},
				],
			} as unknown as SELSchema;

			it("renders struct fields as property type with checker", () => {
				const checker = new SELChecker(structSchema);
				const expr = "pool.getPool(solInt(1)).";
				const result = complete(
					expr,
					expr.length,
					structSchema,
					false,
					checker,
				);

				expect(result).not.toBeNull();
				const tokenOpt = result?.options.find((o) => o.label === "token");
				expect(tokenOpt?.type).toBe("property");
				expect(tokenOpt?.detail).toBe("sol_address");

				const balanceOpt = result?.options.find((o) => o.label === "balance");
				expect(balanceOpt?.type).toBe("property");
			});

			it("renders contract methods as method type with checker", () => {
				const checker = new SELChecker(structSchema);
				const result = complete("pool.", 5, structSchema, false, checker);

				expect(result).not.toBeNull();
				const getPool = result?.options.find((o) => o.label === "getPool");
				expect(getPool?.type).toBe("method");
			});

			it("does not show broad fallback when checker resolves a struct type", () => {
				const checker = new SELChecker(structSchema);
				const expr = "pool.getPool(solInt(1)).";
				const result = complete(
					expr,
					expr.length,
					structSchema,
					false,
					checker,
				);

				const opts = labels(result);

				// Should only show struct fields, not all methods/macros
				expect(opts).not.toContain("getPool");
				expect(opts).not.toContain("totalLiquidity");
				expect(opts).not.toContain("all");

				// Should show struct fields
				expect(opts).toContain("token");
				expect(opts).toContain("balance");
			});

			it("shows broad fallback for unknown receiver", () => {
				// Unknown receiver falls back to allDotCompletions
				const result = complete("foo.", 4, structSchema);
				const opts = labels(result);

				// Broad fallback includes methods + macros + struct fields
				expect(opts).toContain("getPool");
				expect(opts).toContain("all");
				expect(opts).toContain("token");
			});

			it("resolves dot completions via checker.dotCompletions directly", () => {
				const checker = new SELChecker(structSchema);
				const result = complete("pool.", 5, structSchema, false, checker);
				expect(result).not.toBeNull();
				const opts = labels(result);
				expect(opts).toContain("getPool");
				expect(opts).toContain("totalLiquidity");
			});

			it("narrows call-arg completions by expected parameter type", () => {
				// erc20.balanceOf expects sol_address parameter at index 0
				const checker = new SELChecker(testSchema);
				const expr = "erc20.balanceOf(";
				const result = complete(expr, expr.length, testSchema, false, checker);
				expect(result).not.toBeNull();
				const opts = labels(result);

				// user is sol_address — should be included
				expect(opts).toContain("user");

				// blockNumber is sol_int — not sol_address compatible, should be excluded
				expect(opts).not.toContain("blockNumber");

				// erc20 is a contract — not sol_address compatible
				expect(opts).not.toContain("erc20");
			});

			it("call-arg with no expected type falls back to top-level", () => {
				const checker = new SELChecker(testSchema);

				// Use a function that doesn't exist — expectedTypeFor returns undefined
				const expr = "unknownFunc(";
				const result = complete(expr, expr.length, testSchema, true, checker);

				// Should fall back to top-level completions
				expect(result).not.toBeNull();
				const opts = labels(result);
				expect(opts).toContain("erc20");
				expect(opts).toContain("user");
			});
		});
	});
});
