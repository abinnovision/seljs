import { describe, expect, it } from "vitest";

import { SELChecker } from "./checker.js";

import type { ContractSchema, MethodSchema, SELSchema } from "@seljs/schema";

/**
 * Creates a method schema for checker tests.
 * The `abi` field is required by MethodSchema but unused by the checker,
 * so we omit it here and cast to satisfy the type.
 */
const method = (m: Omit<MethodSchema, "abi">): MethodSchema =>
	m as MethodSchema;

/**
 * Creates a contract schema for checker tests.
 * The `address` field is required by ContractSchema but unused by the checker,
 * so we omit it here and cast to satisfy the type.
 */
const contract = (c: Omit<ContractSchema, "address">): ContractSchema =>
	c as ContractSchema;

const ERC20_SCHEMA: SELSchema = {
	version: "1.0.0",
	contracts: [
		{
			name: "erc20",
			address: "0x6B175474E89094C44Da98b954EedeAC495271d0F",
			methods: [
				method({
					name: "balanceOf",
					params: [{ name: "account", type: "sol_address" }],
					returns: "sol_int",
				}),
				method({
					name: "totalSupply",
					params: [],
					returns: "sol_int",
				}),
				method({
					name: "name",
					params: [],
					returns: "string",
				}),
			],
		},
	],
	variables: [
		{ name: "user", type: "sol_address" },
		{ name: "threshold", type: "sol_int" },
	],
	types: [],
	functions: [
		{
			name: "size",
			signature: "size(list|map|string): int",
			params: [{ name: "value", type: "list|map|string" }],
			returns: "int",
		},
		{
			name: "size",
			signature: "string.size(): int",
			params: [],
			returns: "int",
			receiverType: "string",
		},
		{
			name: "startsWith",
			signature: "string.startsWith(prefix): bool",
			params: [{ name: "prefix", type: "string" }],
			returns: "bool",
			receiverType: "string",
		},
		{
			name: "contains",
			signature: "string.contains(substring): bool",
			params: [{ name: "substring", type: "string" }],
			returns: "bool",
			receiverType: "string",
		},
	],
	macros: [],
};

describe("src/checker/checker.ts", () => {
	describe("check()", () => {
		it("returns valid for correct expressions", () => {
			const checker = new SELChecker(ERC20_SCHEMA);
			const result = checker.check("erc20.totalSupply()");

			expect(result.valid).toBe(true);
			expect(result.type).toBe("sol_int");
			expect(result.diagnostics).toEqual([]);
		});

		it("returns valid for contract method with args", () => {
			const checker = new SELChecker(ERC20_SCHEMA);
			const result = checker.check("erc20.balanceOf(user)");

			expect(result.valid).toBe(true);
			expect(result.type).toBe("sol_int");
		});

		it("returns valid for arithmetic on results", () => {
			const checker = new SELChecker(ERC20_SCHEMA);
			const result = checker.check("erc20.balanceOf(user) > threshold");

			expect(result.valid).toBe(true);
			expect(result.type).toBe("bool");
		});

		it("returns diagnostics for parse errors", () => {
			const checker = new SELChecker(ERC20_SCHEMA);
			const result = checker.check("invalid..expr");

			expect(result.valid).toBe(false);
			expect(result.diagnostics.length).toBeGreaterThan(0);
			expect(result.diagnostics[0]?.severity).toBe("error");
		});

		it("returns diagnostics for type errors", () => {
			const checker = new SELChecker(ERC20_SCHEMA);
			const result = checker.check("erc20.totalSupply() + true");

			expect(result.valid).toBe(false);
			expect(result.diagnostics.length).toBeGreaterThan(0);
		});

		it("returns valid for simple literals", () => {
			const checker = new SELChecker(ERC20_SCHEMA);

			expect(checker.check("1 + 2").valid).toBe(true);
			expect(checker.check("true || false").valid).toBe(true);
			expect(checker.check('"hello"').valid).toBe(true);
		});
	});

	describe("typeOf()", () => {
		it("infers sol_int for contract calls returning uint256", () => {
			const checker = new SELChecker(ERC20_SCHEMA);
			expect(checker.typeOf("erc20.totalSupply()")).toBe("sol_int");
		});

		it("infers string for name()", () => {
			const checker = new SELChecker(ERC20_SCHEMA);
			expect(checker.typeOf("erc20.name()")).toBe("string");
		});

		it("infers bool for comparisons", () => {
			const checker = new SELChecker(ERC20_SCHEMA);
			expect(checker.typeOf("erc20.totalSupply() > threshold")).toBe("bool");
		});

		it("returns undefined for invalid expressions", () => {
			const checker = new SELChecker(ERC20_SCHEMA);
			expect(checker.typeOf("invalid..")).toBeUndefined();
		});
	});

	describe("typeAt()", () => {
		it("returns variable type at identifier position", () => {
			const checker = new SELChecker(ERC20_SCHEMA);
			const result = checker.typeAt("user", 2);

			expect(result).toBeDefined();
			expect(result?.type).toBe("sol_address");
		});

		it("returns contract type at contract name position", () => {
			const checker = new SELChecker(ERC20_SCHEMA);
			const result = checker.typeAt("erc20.totalSupply()", 3);

			expect(result).toBeDefined();
			expect(result?.type).toBe("SEL_Contract_erc20");
		});

		it("returns undefined for out-of-range offset", () => {
			const checker = new SELChecker(ERC20_SCHEMA);
			expect(checker.typeAt("user", -1)).toBeUndefined();
			expect(checker.typeAt("user", 100)).toBeUndefined();
		});

		it("returns full expression type as fallback", () => {
			const checker = new SELChecker(ERC20_SCHEMA);

			// At a position that is in an operator, fall back to full type
			const result = checker.typeAt("1 + 2", 2);

			expect(result).toBeDefined();
			expect(result?.type).toBe("int");
		});

		it("resolves chain type (not full-expression type) for chained size()", () => {
			const checker = new SELChecker(ERC20_SCHEMA);

			/*
			 * Full expression is "bool", but the chain erc20.name().size() is "int"
			 * Cursor on "size" at offset 15
			 */
			const expr = "erc20.name().size() > 5";
			const result = checker.typeAt(expr, 15);

			expect(result).toBeDefined();
			expect(result?.type).toBe("int");
			expect(result?.from).toBe(0);

			// "erc20.name().size()" = 19 chars
			expect(result?.to).toBe(19);
		});

		it("resolves chain type for chained startsWith in compound expression", () => {
			const checker = new SELChecker(ERC20_SCHEMA);

			/*
			 * Full expression is "bool" (because of &&), chain is also "bool" but with different span
			 * Cursor on "startsWith" at offset 16
			 */
			const expr = 'erc20.name().startsWith("x") && true';
			const result = checker.typeAt(expr, 16);

			expect(result).toBeDefined();
			expect(result?.type).toBe("bool");

			// Should resolve the DOT-ACCESS chain, not the full expression
			expect(result?.from).toBe(0);

			// 'erc20.name().startsWith("x")' = 28 chars
			expect(result?.to).toBe(28);
		});

		it("resolves chain type for chained contains in compound expression", () => {
			const checker = new SELChecker(ERC20_SCHEMA);

			// Cursor on "contains" at offset 16
			const expr = 'erc20.name().contains("test") == true';
			const result = checker.typeAt(expr, 16);

			expect(result).toBeDefined();
			expect(result?.type).toBe("bool");
			expect(result?.from).toBe(0);

			// 'erc20.name().contains("test")' = 29 chars
			expect(result?.to).toBe(29);
		});

		it("resolves multi-level member access within larger expression", () => {
			const checker = new SELChecker(ERC20_SCHEMA);

			// Cursor on "balanceOf" within a comparison expression
			const expr = "erc20.balanceOf(user) > threshold";
			const result = checker.typeAt(expr, 8);

			expect(result).toBeDefined();
			expect(result?.type).toBe("sol_int");
			expect(result?.from).toBe(0);
			expect(result?.to).toBe(21);
		});
	});

	describe("completionsAt()", () => {
		it("provides dot-access completions for contracts", () => {
			const checker = new SELChecker(ERC20_SCHEMA);
			const info = checker.completionsAt("erc20.", 6);

			expect(info.kind).toBe("dot-access");
			expect(info.items.length).toBe(3);

			const labels = info.items.map((i) => i.label);
			expect(labels).toContain("balanceOf");
			expect(labels).toContain("totalSupply");
			expect(labels).toContain("name");
		});

		it("includes parameter details in method completions", () => {
			const checker = new SELChecker(ERC20_SCHEMA);
			const info = checker.completionsAt("erc20.", 6);

			const balanceOf = info.items.find((i) => i.label === "balanceOf");
			expect(balanceOf?.type).toBe("sol_int");
			expect(balanceOf?.detail).toContain("account: sol_address");
		});

		it("provides top-level completions", () => {
			const checker = new SELChecker(ERC20_SCHEMA);
			const info = checker.completionsAt("", 0);

			expect(info.kind).toBe("top-level");

			const labels = info.items.map((i) => i.label);
			expect(labels).toContain("user");
			expect(labels).toContain("threshold");
			expect(labels).toContain("erc20");
			expect(labels).toContain("size");
		});

		it("returns empty items for unknown dot-access receiver", () => {
			const checker = new SELChecker(ERC20_SCHEMA);
			const info = checker.completionsAt("unknown.", 8);

			expect(info.kind).toBe("dot-access");
			expect(info.items).toEqual([]);
		});

		it("excludes receiver methods from top-level completions", () => {
			const checker = new SELChecker(ERC20_SCHEMA);
			const info = checker.completionsAt("", 0);

			const labels = info.items.map((i) => i.label);
			expect(labels).not.toContain("startsWith");
			expect(labels).not.toContain("contains");

			// Free functions should still be present
			expect(labels).toContain("size");
		});

		it("returns string receiver methods for string-typed expressions", () => {
			const checker = new SELChecker(ERC20_SCHEMA);

			// erc20.name() returns string, so ".startsWith" should appear
			const expr = "erc20.name().";
			const info = checker.completionsAt(expr, expr.length);

			expect(info.kind).toBe("dot-access");
			expect(info.receiverType).toBe("string");

			const labels = info.items.map((i) => i.label);
			expect(labels).toContain("startsWith");
			expect(labels).toContain("contains");
		});

		it("returns size in dot-access completions for string-typed expressions", () => {
			const checker = new SELChecker(ERC20_SCHEMA);
			const expr = "erc20.name().";
			const info = checker.completionsAt(expr, expr.length);

			const labels = info.items.map((i) => i.label);
			expect(labels).toContain("size");
		});

		it("provides completions for dot-access inside nested call arguments", () => {
			const checker = new SELChecker(ERC20_SCHEMA);

			// Cursor after "erc20.name()." inside startsWith(...)
			const expr = "erc20.name().startsWith(erc20.name().";
			const info = checker.completionsAt(expr, expr.length);

			expect(info.kind).toBe("dot-access");
			expect(info.receiverType).toBe("string");

			const labels = info.items.map((i) => i.label);
			expect(labels).toContain("startsWith");
			expect(labels).toContain("contains");
			expect(labels).toContain("size");
		});

		it("does not return receiver methods for non-matching types", () => {
			const checker = new SELChecker(ERC20_SCHEMA);

			// erc20.totalSupply() returns uint256, not string
			const expr = "erc20.totalSupply().";
			const info = checker.completionsAt(expr, expr.length);

			expect(info.kind).toBe("dot-access");
			const labels = info.items.map((i) => i.label);
			expect(labels).not.toContain("startsWith");
		});
	});

	describe("expectedTypeAt()", () => {
		it("infers sol_int after > with sol_int left operand", () => {
			const checker = new SELChecker(ERC20_SCHEMA);
			const expr = "erc20.balanceOf(user) > ";
			const result = checker.expectedTypeAt(expr, expr.length);

			expect(result).toBeDefined();
			expect(result?.expectedType).toBe("sol_int");
			expect(result?.context).toBe("operator");
		});

		it("infers bool after && operator", () => {
			const checker = new SELChecker(ERC20_SCHEMA);
			const expr = "erc20.balanceOf(user) > threshold && ";
			const result = checker.expectedTypeAt(expr, expr.length);

			expect(result).toBeDefined();
			expect(result?.expectedType).toBe("bool");
			expect(result?.context).toBe("operator");
		});

		it("infers sol_int after + with sol_int left operand", () => {
			const checker = new SELChecker(ERC20_SCHEMA);
			const expr = "erc20.balanceOf(user) + ";
			const result = checker.expectedTypeAt(expr, expr.length);

			expect(result).toBeDefined();
			expect(result?.expectedType).toBe("sol_int");
			expect(result?.context).toBe("operator");
		});

		it("infers address for function argument by parameter position", () => {
			const checker = new SELChecker(ERC20_SCHEMA);
			const expr = "erc20.balanceOf(";
			const result = checker.expectedTypeAt(expr, expr.length);

			expect(result).toBeDefined();
			expect(result?.expectedType).toBe("sol_address");
			expect(result?.context).toBe("function-argument");
			expect(result?.paramIndex).toBe(0);
			expect(result?.functionName).toBe("balanceOf");
		});

		it("returns undefined when no context can be determined", () => {
			const checker = new SELChecker(ERC20_SCHEMA);
			const result = checker.expectedTypeAt("", 0);

			expect(result).toBeUndefined();
		});

		it("returns undefined for union param types", () => {
			const checker = new SELChecker(ERC20_SCHEMA);

			// size() has param type "list|map|string" — too broad to narrow
			const expr = "size(";
			const result = checker.expectedTypeAt(expr, expr.length);

			expect(result).toBeUndefined();
		});

		it("handles multi-character operators correctly", () => {
			const checker = new SELChecker(ERC20_SCHEMA);
			const expr = "erc20.balanceOf(user) >= ";
			const result = checker.expectedTypeAt(expr, expr.length);

			expect(result).toBeDefined();
			expect(result?.expectedType).toBe("sol_int");
		});

		it("handles equality operator", () => {
			const checker = new SELChecker(ERC20_SCHEMA);
			const expr = "erc20.balanceOf(user) == ";
			const result = checker.expectedTypeAt(expr, expr.length);

			expect(result).toBeDefined();
			expect(result?.expectedType).toBe("sol_int");
		});

		it("detects 'in' as trailing operator", () => {
			const checker = new SELChecker(ERC20_SCHEMA);
			const expr = "user in ";
			const result = checker.expectedTypeAt(expr, expr.length);
			expect(result).toBeUndefined();
		});
	});

	describe("struct completions", () => {
		const STRUCT_SCHEMA: SELSchema = {
			version: "1.0.0",
			contracts: [
				contract({
					name: "pool",
					methods: [
						method({
							name: "getPool",
							params: [{ name: "id", type: "sol_int" }],
							returns: "SEL_Struct_pool_getPool",
						}),
						method({
							name: "getInfo",
							params: [],
							returns: "SEL_Struct_pool_getInfo",
						}),
						method({
							name: "totalLiquidity",
							params: [],
							returns: "sol_int",
						}),
					],
				}),
			],
			variables: [],
			types: [
				// Nested struct must come before parent (registration order)
				{
					name: "SEL_Struct_pool_getInfo__details",
					kind: "struct",
					fields: [
						{ name: "token", type: "sol_address" },
						{ name: "amount", type: "sol_int" },
					],
				},
				{
					name: "SEL_Struct_pool_getPool",
					kind: "struct",
					fields: [
						{ name: "token", type: "sol_address" },
						{ name: "balance", type: "sol_int" },
					],
				},
				{
					name: "SEL_Struct_pool_getInfo",
					kind: "struct",
					fields: [
						{
							name: "details",
							type: "SEL_Struct_pool_getInfo__details",
						},
						{ name: "active", type: "bool" },
					],
				},
				{
					name: "SEL_Struct_empty",
					kind: "struct",
					fields: [],
				},
			],
			functions: [],
			macros: [],
		};

		it("returns struct fields for a struct-returning method", () => {
			const checker = new SELChecker(STRUCT_SCHEMA);
			const expr = "pool.getPool(solInt(1)).";
			const info = checker.completionsAt(expr, expr.length);

			expect(info.kind).toBe("dot-access");
			expect(info.receiverType).toBe("SEL_Struct_pool_getPool");

			const labels = info.items.map((i) => i.label);
			expect(labels).toContain("token");
			expect(labels).toContain("balance");
			expect(labels).toHaveLength(2);
		});

		it("returns correct type and detail for struct field items", () => {
			const checker = new SELChecker(STRUCT_SCHEMA);
			const expr = "pool.getPool(solInt(1)).";
			const info = checker.completionsAt(expr, expr.length);

			const tokenItem = info.items.find((i) => i.label === "token");
			expect(tokenItem?.type).toBe("sol_address");
			expect(tokenItem?.detail).toBe("sol_address");

			const balanceItem = info.items.find((i) => i.label === "balance");
			expect(balanceItem?.type).toBe("sol_int");
			expect(balanceItem?.detail).toBe("sol_int");
		});

		it("returns nested struct fields for chained dot-access", () => {
			const checker = new SELChecker(STRUCT_SCHEMA);
			const expr = "pool.getInfo().details.";
			const info = checker.completionsAt(expr, expr.length);

			expect(info.kind).toBe("dot-access");
			expect(info.receiverType).toBe("SEL_Struct_pool_getInfo__details");

			const labels = info.items.map((i) => i.label);
			expect(labels).toContain("token");
			expect(labels).toContain("amount");
			expect(labels).toHaveLength(2);
		});

		it("returns empty items for non-struct known type", () => {
			const checker = new SELChecker(STRUCT_SCHEMA);

			// totalLiquidity() returns uint256, not a struct
			const expr = "pool.totalLiquidity().";
			const info = checker.completionsAt(expr, expr.length);

			expect(info.kind).toBe("dot-access");
			expect(info.items).toHaveLength(0);
		});

		it("returns empty items for empty struct", () => {
			const checker = new SELChecker({
				...STRUCT_SCHEMA,
				contracts: [
					contract({
						name: "test",
						methods: [
							method({
								name: "getData",
								params: [],
								returns: "SEL_Struct_empty",
							}),
						],
					}),
				],
			});
			const expr = "test.getData().";
			const info = checker.completionsAt(expr, expr.length);

			expect(info.kind).toBe("dot-access");
			expect(info.receiverType).toBe("SEL_Struct_empty");
			expect(info.items).toHaveLength(0);
		});

		it("reflects struct types after updateSchema()", () => {
			const checker = new SELChecker(ERC20_SCHEMA);

			checker.updateSchema(STRUCT_SCHEMA);

			const expr = "pool.getPool(solInt(1)).";
			const info = checker.completionsAt(expr, expr.length);

			expect(info.kind).toBe("dot-access");
			const labels = info.items.map((i) => i.label);
			expect(labels).toContain("token");
			expect(labels).toContain("balance");
		});
	});

	describe("dotCompletions()", () => {
		it("returns contract methods for a contract name", () => {
			const checker = new SELChecker(ERC20_SCHEMA);
			const info = checker.dotCompletions("erc20");

			expect(info.kind).toBe("dot-access");
			const labels = info.items.map((i) => i.label);
			expect(labels).toContain("balanceOf");
			expect(labels).toContain("totalSupply");
			expect(labels).toContain("name");
		});

		it("returns string methods for a string-typed expression", () => {
			const checker = new SELChecker(ERC20_SCHEMA);
			const info = checker.dotCompletions("erc20.name()");

			expect(info.kind).toBe("dot-access");
			expect(info.receiverType).toBe("string");
			const labels = info.items.map((i) => i.label);
			expect(labels).toContain("startsWith");
			expect(labels).toContain("contains");
		});

		it("returns empty items for unknown receiver", () => {
			const checker = new SELChecker(ERC20_SCHEMA);
			const info = checker.dotCompletions("unknown");

			expect(info.kind).toBe("dot-access");
			expect(info.items).toEqual([]);
		});
	});

	describe("expectedTypeFor()", () => {
		it("returns expected type for operator context", () => {
			const checker = new SELChecker(ERC20_SCHEMA);
			const result = checker.expectedTypeFor({
				kind: "operator",
				leftExpression: "erc20.balanceOf(user)",
				operator: ">",
			});

			expect(result).toBe("sol_int");
		});

		it("returns expected type for function argument context", () => {
			const checker = new SELChecker(ERC20_SCHEMA);
			const result = checker.expectedTypeFor({
				kind: "function-arg",
				receiverName: "erc20",
				functionName: "balanceOf",
				paramIndex: 0,
			});

			expect(result).toBe("sol_address");
		});

		it("returns undefined for union param types", () => {
			const checker = new SELChecker(ERC20_SCHEMA);
			const result = checker.expectedTypeFor({
				kind: "function-arg",
				functionName: "size",
				paramIndex: 0,
			});

			expect(result).toBeUndefined();
		});

		it("returns bool for && operator", () => {
			const checker = new SELChecker(ERC20_SCHEMA);
			const result = checker.expectedTypeFor({
				kind: "operator",
				leftExpression: "erc20.balanceOf(user) > threshold",
				operator: "&&",
			});

			expect(result).toBe("bool");
		});
	});

	describe("updateSchema()", () => {
		it("rebuilds environment with new schema", () => {
			const checker = new SELChecker(ERC20_SCHEMA);
			expect(checker.typeOf("erc20.totalSupply()")).toBe("sol_int");

			// Update with schema that has no contracts
			checker.updateSchema({
				...ERC20_SCHEMA,
				contracts: [],
			});

			// erc20 should no longer be known
			const result = checker.check("erc20.totalSupply()");
			expect(result.valid).toBe(false);
		});

		it("reflects new variables after update", () => {
			const checker = new SELChecker(ERC20_SCHEMA);

			checker.updateSchema({
				...ERC20_SCHEMA,
				variables: [
					...ERC20_SCHEMA.variables,
					{ name: "newVar", type: "bool" },
				],
			});

			const info = checker.completionsAt("", 0);
			const labels = info.items.map((i) => i.label);
			expect(labels).toContain("newVar");
		});
	});
});
