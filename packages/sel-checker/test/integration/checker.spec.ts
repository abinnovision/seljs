import { describe, expect, it } from "vitest";

import {
	createTestSchema,
	ERC20_SCHEMA,
	ERC721_CONTRACT,
	FULL_SCHEMA,
} from "./fixtures.js";
import { SELChecker } from "../../src/index.js";

import type { ContractSchema, MethodSchema } from "@seljs/schema";

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

/*
 * ---------------------------------------------------------------------------
 * Test-case types — each row can assert multiple checker behaviours
 * ---------------------------------------------------------------------------
 */

interface CheckCase {
	expr: string;
	valid: boolean;
	type?: string;

	/** Minimum number of diagnostics when invalid */
	minDiagnostics?: number;
}

interface TypeAtCase {
	expr: string;
	offset: number;
	type?: string;
	from?: number;
	to?: number;
}

interface CompletionCase {
	expr: string;
	offset: number;
	kind: "top-level" | "dot-access";
	includes?: string[];
	excludes?: string[];
	receiverType?: string;
}

interface ExpectedTypeCase {
	expr: string;
	offset: number;
	expectedType?: string;
	context?: "operator" | "function-argument";
	paramIndex?: number;
	functionName?: string;
}

/*
 * ---------------------------------------------------------------------------
 * Helpers
 * ---------------------------------------------------------------------------
 */

function labels(checker: SELChecker, expr: string, offset: number): string[] {
	return checker.completionsAt(expr, offset).items.map((i) => i.label);
}

/*
 * ===================================================================
 * ERC20 Group
 * ===================================================================
 */

describe("erc20 integration", () => {
	const checker = new SELChecker(ERC20_SCHEMA);

	/*
	 * ---------------------------------------------------------------
	 * check() + typeOf()
	 * ---------------------------------------------------------------
	 */

	const checkCases: CheckCase[] = [
		// Simple contract calls
		{ expr: "erc20.totalSupply()", valid: true, type: "sol_int" },
		{ expr: "erc20.balanceOf(user)", valid: true, type: "sol_int" },
		{ expr: "erc20.name()", valid: true, type: "string" },
		{ expr: "erc20.symbol()", valid: true, type: "string" },
		{ expr: "erc20.decimals()", valid: true, type: "sol_int" },
		{
			expr: "erc20.allowance(user, spender)",
			valid: true,
			type: "sol_int",
		},

		// Variables
		{ expr: "user", valid: true, type: "sol_address" },
		{ expr: "threshold", valid: true, type: "sol_int" },
		{ expr: "active", valid: true, type: "bool" },

		// Operators
		{ expr: "erc20.balanceOf(user) > threshold", valid: true, type: "bool" },
		{
			expr: "erc20.balanceOf(user) + erc20.totalSupply()",
			valid: true,
			type: "sol_int",
		},
		{
			expr: "erc20.balanceOf(user) >= threshold && active",
			valid: true,
			type: "bool",
		},
		{ expr: "erc20.balanceOf(user) != threshold", valid: true, type: "bool" },
		{ expr: "erc20.balanceOf(user) == threshold", valid: true, type: "bool" },
		{
			expr: "erc20.balanceOf(user) * solInt(2)",
			valid: true,
			type: "sol_int",
		},

		// Method chaining (string receiver methods)
		{ expr: "erc20.name().size()", valid: true, type: "int" },
		{ expr: 'erc20.name().startsWith("USD")', valid: true, type: "bool" },
		{ expr: 'erc20.name().contains("DAI")', valid: true, type: "bool" },
		{ expr: 'erc20.symbol().endsWith("I")', valid: true, type: "bool" },

		// Chained comparisons
		{ expr: "erc20.name().size() > 0", valid: true, type: "bool" },
		{
			expr: 'erc20.name().startsWith("USD") && active',
			valid: true,
			type: "bool",
		},

		// Cast functions
		{ expr: "solInt(0)", valid: true, type: "sol_int" },
		{ expr: "solInt(0)", valid: true, type: "sol_int" },
		{
			expr: "erc20.balanceOf(user) + solInt(100)",
			valid: true,
			type: "sol_int",
		},

		// formatUnits / parseUnits accept sol_int for decimals
		{
			expr: "formatUnits(erc20.balanceOf(user), erc20.decimals())",
			valid: true,
			type: "double",
		},
		{
			expr: 'parseUnits("1", erc20.decimals())',
			valid: true,
			type: "sol_int",
		},

		// `sel.*` namespace constants
		{ expr: "sel.WAD", valid: true, type: "sol_int" },
		{ expr: "sel.RAY", valid: true, type: "sol_int" },
		{ expr: "sel.Q96", valid: true, type: "sol_int" },
		{ expr: "sel.Q128", valid: true, type: "sol_int" },
		{ expr: "sel.MAX_UINT256", valid: true, type: "sol_int" },
		{ expr: "sel.ZERO_ADDRESS", valid: true, type: "sol_address" },
		{
			expr: "erc20.balanceOf(user) > sel.WAD",
			valid: true,
			type: "bool",
		},

		// Literals
		{ expr: "true", valid: true, type: "bool" },
		{ expr: "1 + 2", valid: true, type: "int" },
		{ expr: '"hello"', valid: true, type: "string" },

		// Invalid — parse errors
		{ expr: "erc20.", valid: false, minDiagnostics: 1 },
		{ expr: "invalid..expr", valid: false, minDiagnostics: 1 },
		{ expr: "erc20.balanceOf(", valid: false, minDiagnostics: 1 },

		// Invalid — type errors
		{ expr: "erc20.totalSupply() + true", valid: false, minDiagnostics: 1 },
		{
			expr: "erc20.balanceOf(threshold)",
			valid: false,
			minDiagnostics: 1,
		},
		{ expr: "erc20.unknownMethod()", valid: false, minDiagnostics: 1 },
		{ expr: "unknownContract.method()", valid: false, minDiagnostics: 1 },
	];

	const validCheckCases = checkCases.filter((c) => c.valid);
	const invalidCheckCases = checkCases.filter((c) => !c.valid);

	describe("check()", () => {
		it.each(validCheckCases)("$expr → valid", ({ expr, type }) => {
			const result = checker.check(expr);
			expect(result.valid).toBe(true);
			expect(result.type).toBe(type);
			expect(result.diagnostics).toEqual([]);
		});

		it.each(invalidCheckCases)(
			"$expr → invalid",
			({ expr, minDiagnostics }) => {
				const result = checker.check(expr);
				expect(result.valid).toBe(false);
				expect(result.diagnostics.length).toBeGreaterThanOrEqual(
					minDiagnostics ?? 1,
				);
			},
		);
	});

	describe("typeOf()", () => {
		it.each(validCheckCases)("$expr → $type", ({ expr, type }) => {
			expect(checker.typeOf(expr)).toBe(type);
		});

		it.each(invalidCheckCases)("$expr → undefined", ({ expr }) => {
			expect(checker.typeOf(expr)).toBeUndefined();
		});
	});

	/*
	 * ---------------------------------------------------------------
	 * typeAt() — cursor position type resolution
	 * ---------------------------------------------------------------
	 */

	const typeAtCases: TypeAtCase[] = [
		// Variable hover
		{ expr: "user", offset: 2, type: "sol_address", from: 0, to: 4 },
		{ expr: "threshold", offset: 4, type: "sol_int", from: 0, to: 9 },

		// Contract name hover
		{
			expr: "erc20.balanceOf(user)",
			offset: 3,
			type: "SEL_Contract_erc20",
			from: 0,
			to: 5,
		},

		// Dot-access chain resolves to method return type
		{
			expr: "erc20.balanceOf(user) > threshold",
			offset: 8,
			type: "sol_int",
			from: 0,
			to: 21,
		},

		// Variable inside argument
		{
			expr: "erc20.balanceOf(user)",
			offset: 18,
			type: "sol_address",
			from: 16,
			to: 20,
		},

		// Method chaining — cursor on chained method
		{
			expr: "erc20.name().size() > 5",
			offset: 15,
			type: "int",
			from: 0,
			to: 19,
		},

		// Method chaining — cursor on startsWith in compound expr
		{
			expr: 'erc20.name().startsWith("x") && true',
			offset: 16,
			type: "bool",
			from: 0,
			to: 28,
		},

		// Operator fallback — cursor on operator
		{ expr: "1 + 2", offset: 2, type: "int", from: 0, to: 5 },

		// Out of bounds
		{ expr: "user", offset: -1, type: undefined },
		{ expr: "user", offset: 100, type: undefined },
	];

	const definedTypeAtCases = typeAtCases.filter((c) => c.type !== undefined);
	const undefinedTypeAtCases = typeAtCases.filter((c) => c.type === undefined);

	describe("typeAt()", () => {
		it.each(definedTypeAtCases)(
			"$expr at offset $offset → $type",
			({ expr, offset, type, from, to }) => {
				const result = checker.typeAt(expr, offset);
				expect(result).toBeDefined();
				expect(result?.type).toBe(type);
				expect(result?.from).toBe(from);
				expect(result?.to).toBe(to);
			},
		);

		it.each(undefinedTypeAtCases)(
			"$expr at offset $offset → undefined",
			({ expr, offset }) => {
				expect(checker.typeAt(expr, offset)).toBeUndefined();
			},
		);
	});

	/*
	 * ---------------------------------------------------------------
	 * completionsAt()
	 * ---------------------------------------------------------------
	 */

	const completionCases: CompletionCase[] = [
		// Top-level
		{
			expr: "",
			offset: 0,
			kind: "top-level",
			includes: ["user", "erc20", "threshold", "size"],
			excludes: ["startsWith", "contains"],
		},

		// Contract dot-access
		{
			expr: "erc20.",
			offset: 6,
			kind: "dot-access",
			includes: ["balanceOf", "totalSupply", "name", "symbol", "allowance"],
		},

		// String receiver methods after chain
		{
			expr: "erc20.name().",
			offset: 13,
			kind: "dot-access",
			receiverType: "string",
			includes: ["startsWith", "contains", "size"],
		},

		// No string methods for uint256 receiver
		{
			expr: "erc20.totalSupply().",
			offset: 20,
			kind: "dot-access",
			excludes: ["startsWith", "contains"],
		},

		// Nested call context — completions inside argument
		{
			expr: "erc20.name().startsWith(erc20.name().",
			offset: 37,
			kind: "dot-access",
			receiverType: "string",
			includes: ["startsWith", "contains", "size"],
		},

		// Unknown receiver
		{
			expr: "unknown.",
			offset: 8,
			kind: "dot-access",
			includes: [],
		},
	];

	const receiverTypeCases = completionCases.filter(
		(c) => c.receiverType !== undefined,
	);

	describe("completionsAt()", () => {
		it.each(completionCases)(
			"$expr at $offset → $kind",
			({ expr, offset, kind, includes, excludes }) => {
				const info = checker.completionsAt(expr, offset);
				expect(info.kind).toBe(kind);

				const itemLabels = info.items.map((i) => i.label);
				for (const l of includes ?? []) {
					expect(itemLabels, `expected "${l}" in completions`).toContain(l);
				}

				for (const l of excludes ?? []) {
					expect(itemLabels, `unexpected "${l}" in completions`).not.toContain(
						l,
					);
				}
			},
		);

		it.each(receiverTypeCases)(
			"$expr at $offset has receiverType=$receiverType",
			({ expr, offset, receiverType }) => {
				expect(checker.completionsAt(expr, offset).receiverType).toBe(
					receiverType,
				);
			},
		);
	});

	/*
	 * ---------------------------------------------------------------
	 * expectedTypeAt()
	 * ---------------------------------------------------------------
	 */

	const expectedTypeCases: ExpectedTypeCase[] = [
		// Operator context
		{
			expr: "erc20.balanceOf(user) > ",
			offset: 24,
			expectedType: "sol_int",
			context: "operator",
		},
		{
			expr: "erc20.balanceOf(user) >= ",
			offset: 25,
			expectedType: "sol_int",
			context: "operator",
		},
		{
			expr: "erc20.balanceOf(user) == ",
			offset: 25,
			expectedType: "sol_int",
			context: "operator",
		},
		{
			expr: "erc20.balanceOf(user) != ",
			offset: 25,
			expectedType: "sol_int",
			context: "operator",
		},
		{
			expr: "erc20.balanceOf(user) + ",
			offset: 24,
			expectedType: "sol_int",
			context: "operator",
		},
		{
			expr: "erc20.balanceOf(user) > threshold && ",
			offset: 37,
			expectedType: "bool",
			context: "operator",
		},

		// Function argument context
		{
			expr: "erc20.balanceOf(",
			offset: 16,
			expectedType: "sol_address",
			context: "function-argument",
			paramIndex: 0,
			functionName: "balanceOf",
		},
		{
			expr: "erc20.allowance(user, ",
			offset: 22,
			expectedType: "sol_address",
			context: "function-argument",
			paramIndex: 1,
			functionName: "allowance",
		},

		// No context
		{ expr: "", offset: 0, expectedType: undefined },
	];

	const definedExpectedTypeCases = expectedTypeCases.filter(
		(c) => c.expectedType !== undefined,
	);
	const undefinedExpectedTypeCases = expectedTypeCases.filter(
		(c) => c.expectedType === undefined,
	);

	describe("expectedTypeAt()", () => {
		it.each(definedExpectedTypeCases)(
			"$expr at $offset → $expectedType",
			({ expr, offset, expectedType, context, paramIndex, functionName }) => {
				const result = checker.expectedTypeAt(expr, offset);
				expect(result).toBeDefined();
				expect(result?.expectedType).toBe(expectedType);
				expect(result?.context).toBe(context);
				expect(result?.paramIndex).toBe(paramIndex);
				expect(result?.functionName).toBe(functionName);
			},
		);

		it.each(undefinedExpectedTypeCases)(
			"$expr at $offset → undefined",
			({ expr, offset }) => {
				expect(checker.expectedTypeAt(expr, offset)).toBeUndefined();
			},
		);
	});
});

/*
 * ===================================================================
 * ERC721 Group
 * ===================================================================
 */

describe("erc721 integration", () => {
	const checker = new SELChecker(
		createTestSchema({ contracts: [ERC721_CONTRACT] }),
	);

	const checkCases: CheckCase[] = [
		{ expr: "nft.ownerOf(tokenId)", valid: true, type: "sol_address" },
		{ expr: "nft.balanceOf(user)", valid: true, type: "sol_int" },
		{ expr: "nft.name()", valid: true, type: "string" },
		{ expr: "nft.tokenURI(tokenId)", valid: true, type: "string" },
		{ expr: "nft.getApproved(tokenId)", valid: true, type: "sol_address" },
		{
			expr: "nft.isApprovedForAll(user, spender)",
			valid: true,
			type: "bool",
		},
		{ expr: "nft.ownerOf(tokenId) == user", valid: true, type: "bool" },
		{
			expr: 'nft.tokenURI(tokenId).contains(".json")',
			valid: true,
			type: "bool",
		},
		{ expr: "nft.name().size() > 0", valid: true, type: "bool" },
		{
			expr: "nft.ownerOf(solInt(0))",
			valid: true,
			type: "sol_address",
		},
	];

	describe("check()", () => {
		it.each(checkCases)("$expr → valid=$valid", ({ expr, type }) => {
			const result = checker.check(expr);
			expect(result.valid).toBe(true);
			expect(result.type).toBe(type);
		});
	});

	const typeAtCases: TypeAtCase[] = [
		{
			expr: "nft.ownerOf(tokenId) == user",
			offset: 5,
			type: "sol_address",
			from: 0,
			to: 20,
		},
		{
			expr: "nft.isApprovedForAll(user, spender)",
			offset: 5,
			type: "bool",
			from: 0,
			to: 35,
		},
	];

	describe("typeAt()", () => {
		it.each(typeAtCases)(
			"$expr at offset $offset → $type",
			({ expr, offset, type, from, to }) => {
				const result = checker.typeAt(expr, offset);
				expect(result).toBeDefined();
				expect(result?.type).toBe(type);
				expect(result?.from).toBe(from);
				expect(result?.to).toBe(to);
			},
		);
	});

	const completionCases: CompletionCase[] = [
		{
			expr: "nft.",
			offset: 4,
			kind: "dot-access",
			includes: ["ownerOf", "balanceOf", "tokenURI", "isApprovedForAll"],
		},
		{
			expr: "nft.name().",
			offset: 11,
			kind: "dot-access",
			receiverType: "string",
			includes: ["startsWith", "contains", "size"],
		},
	];

	const nftReceiverTypeCases = completionCases.filter(
		(c) => c.receiverType !== undefined,
	);

	describe("completionsAt()", () => {
		it.each(completionCases)(
			"$expr at $offset → $kind",
			({ expr, offset, kind, includes }) => {
				const info = checker.completionsAt(expr, offset);
				expect(info.kind).toBe(kind);

				const itemLabels = info.items.map((i) => i.label);
				for (const l of includes ?? []) {
					expect(itemLabels).toContain(l);
				}
			},
		);

		it.each(nftReceiverTypeCases)(
			"$expr at $offset has receiverType=$receiverType",
			({ expr, offset, receiverType }) => {
				expect(checker.completionsAt(expr, offset).receiverType).toBe(
					receiverType,
				);
			},
		);
	});

	const expectedTypeCases: ExpectedTypeCase[] = [
		{
			expr: "nft.ownerOf(tokenId) == ",
			offset: 24,
			expectedType: "sol_address",
			context: "operator",
		},
		{
			expr: "nft.ownerOf(",
			offset: 12,
			expectedType: "sol_int",
			context: "function-argument",
			paramIndex: 0,
			functionName: "ownerOf",
		},
		{
			expr: "nft.isApprovedForAll(user, ",
			offset: 26,
			expectedType: "sol_address",
			context: "function-argument",
			paramIndex: 1,
			functionName: "isApprovedForAll",
		},
	];

	describe("expectedTypeAt()", () => {
		it.each(expectedTypeCases)(
			"$expr at $offset → $expectedType",
			({ expr, offset, expectedType, context, paramIndex, functionName }) => {
				const result = checker.expectedTypeAt(expr, offset);
				expect(result).toBeDefined();
				expect(result?.expectedType).toBe(expectedType);
				expect(result?.context).toBe(context);
				expect(result?.paramIndex).toBe(paramIndex);
				expect(result?.functionName).toBe(functionName);
			},
		);
	});
});

/*
 * ===================================================================
 * Cross-contract (ERC20 + ERC721) Group
 * ===================================================================
 */

describe("cross-contract integration", () => {
	const checker = new SELChecker(FULL_SCHEMA);

	const checkCases: CheckCase[] = [
		// Mix both contracts in one expression
		{
			expr: "erc20.balanceOf(user) > threshold && nft.ownerOf(tokenId) == user",
			valid: true,
			type: "bool",
		},
		{
			expr: "erc20.balanceOf(nft.getApproved(tokenId))",
			valid: true,
			type: "sol_int",
		},
		{
			expr: "nft.balanceOf(user) > solInt(0) || erc20.balanceOf(user) > threshold",
			valid: true,
			type: "bool",
		},
		{
			expr: 'erc20.name().contains("DAI") && nft.name().size() > 0',
			valid: true,
			type: "bool",
		},
	];

	describe("check()", () => {
		it.each(checkCases)("$expr → valid=$valid", ({ expr, type }) => {
			const result = checker.check(expr);
			expect(result.valid).toBe(true);
			expect(result.type).toBe(type);
		});
	});

	describe("completionsAt()", () => {
		it("top-level includes both contracts", () => {
			const itemLabels = labels(checker, "", 0);
			expect(itemLabels).toContain("erc20");
			expect(itemLabels).toContain("nft");
		});

		it("erc20. shows erc20 methods, not nft methods", () => {
			const itemLabels = labels(checker, "erc20.", 6);
			expect(itemLabels).toContain("balanceOf");
			expect(itemLabels).toContain("allowance");
			expect(itemLabels).not.toContain("ownerOf");
		});

		it("nft. shows nft methods, not erc20-only methods", () => {
			const itemLabels = labels(checker, "nft.", 4);
			expect(itemLabels).toContain("ownerOf");
			expect(itemLabels).toContain("tokenURI");
			expect(itemLabels).not.toContain("allowance");
		});
	});
});

/*
 * ===================================================================
 * Composable schema — custom contract group
 * ===================================================================
 */

describe("custom composed schema", () => {
	it("works with a single-method contract", () => {
		const schema = createTestSchema({
			contracts: [
				contract({
					name: "vault",
					methods: [
						method({
							name: "getBalance",
							params: [{ name: "token", type: "sol_address" }],
							returns: "sol_int",
						}),
					],
				}),
			],
		});

		const checker = new SELChecker(schema);
		const result = checker.check("vault.getBalance(user)");

		expect(result.valid).toBe(true);
		expect(result.type).toBe("sol_int");
	});

	it("works with no contracts (variables only)", () => {
		const schema = createTestSchema({ contracts: [] });
		const checker = new SELChecker(schema);

		expect(checker.check("user").valid).toBe(true);
		expect(checker.typeOf("user")).toBe("sol_address");
		expect(checker.check("threshold > solInt(0)").valid).toBe(true);
	});

	it("supports schema updates", () => {
		const checker = new SELChecker(ERC20_SCHEMA);
		expect(checker.typeOf("erc20.totalSupply()")).toBe("sol_int");

		// Update to NFT-only schema
		checker.updateSchema(createTestSchema({ contracts: [ERC721_CONTRACT] }));

		// erc20 no longer known
		expect(checker.check("erc20.totalSupply()").valid).toBe(false);

		// nft now available
		expect(checker.typeOf("nft.ownerOf(tokenId)")).toBe("sol_address");
	});
});
