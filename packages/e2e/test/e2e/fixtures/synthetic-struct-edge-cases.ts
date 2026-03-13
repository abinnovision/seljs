import { syntheticStructEdgeCases } from "@seljs-internal/fixtures";

import { defineFixtureGroup } from "../helpers.js";

const abi = syntheticStructEdgeCases.abi;
const ADDRESS = "0x0000000000000000000000000000000000000099";

const USER = "0x0000000000000000000000000000000000000001";
const TOKEN_A = "0x000000000000000000000000000000000000000a";

const nestedDeepResult = {
	id: 42n,
	inner: {
		token: TOKEN_A,
		config: {
			rate: 1500000n,
			active: true,
		},
	},
};

const multiReturnResult = [
	// reserve0 (uint112)
	500000000000000n,

	// reserve1 (uint112)
	300000000000000n,

	// blockTimestampLast (uint32)
	1709251200,
];

export const syntheticStructEdgeCasesFixtures = defineFixtureGroup({
	name: "Synthetic Struct Edge Cases",
	contracts: {
		edge: { abi, address: ADDRESS },
	},
	context: {
		user: "sol_address",
	},
	schema: {
		structs: [
			{
				name: "SEL_Struct_edge_getNestedDeep",
				fieldCount: 2,
				fields: ["id", "inner"],
			},
			{
				name: "SEL_Struct_edge_getMultiReturn",
				fieldCount: 3,
				fields: ["reserve0", "reserve1", "blockTimestampLast"],
			},
		],
	},
	cases: [
		// deeply nested struct — 3 levels deep
		{
			expr: "edge.getNestedDeep()",
			expectedType: "SEL_Struct_edge_getNestedDeep",
			mocks: { getNestedDeep: nestedDeepResult },
			completions: [
				{
					offset: 5,
					includes: [
						"getNestedDeep",
						"getPositions",
						"getAccount",
						"getMultiReturn",
					],
				},
			],
		},
		{
			expr: "edge.getNestedDeep().id",
			expectedType: "sol_int",
			mocks: { getNestedDeep: nestedDeepResult },
			expectedValue: 42n,
		},
		{
			label: "nested struct field access — inner.token (2 levels)",
			expr: "edge.getNestedDeep().inner.token",
			expectedType: "sol_address",
			mocks: { getNestedDeep: nestedDeepResult },
			expectedValue: TOKEN_A,
		},
		{
			label: "deeply nested struct field — inner.config.rate (3 levels)",
			expr: "edge.getNestedDeep().inner.config.rate",
			expectedType: "sol_int",
			mocks: { getNestedDeep: nestedDeepResult },
			expectedValue: 1500000n,
		},
		{
			label: "deeply nested bool — inner.config.active (3 levels)",
			expr: "edge.getNestedDeep().inner.config.active",
			expectedType: "bool",
			mocks: { getNestedDeep: nestedDeepResult },
			expectedValue: true,
		},

		// array-of-tuple return — type-check only (no evaluate for list<struct>)
		{
			expr: "edge.getPositions(user)",
			expectedType: "list<SEL_Struct_edge_getPositions>",
			context: { user: USER },
		},

		// struct with nested tuple[] field — type-check only
		{
			expr: "edge.getAccount(user)",
			expectedType: "SEL_Struct_edge_getAccount",
			context: { user: USER },
		},
		{
			expr: "edge.getAccount(user).owner",
			expectedType: "sol_address",
			context: { user: USER },
		},
		{
			expr: "edge.getAccount(user).nonce",
			expectedType: "sol_int",
			context: { user: USER },
		},

		// multi-return (unnamed tuple wrapping named outputs)
		{
			expr: "edge.getMultiReturn()",
			expectedType: "SEL_Struct_edge_getMultiReturn",
			mocks: { getMultiReturn: multiReturnResult },
			typeAt: [
				{
					offset: 20,
					type: "SEL_Struct_edge_getMultiReturn",
				},
			],
		},
		{
			expr: "edge.getMultiReturn().reserve0",
			expectedType: "sol_int",
			mocks: { getMultiReturn: multiReturnResult },
			expectedValue: 500000000000000n,
		},
		{
			expr: "edge.getMultiReturn().reserve1",
			expectedType: "sol_int",
			mocks: { getMultiReturn: multiReturnResult },
			expectedValue: 300000000000000n,
		},
		{
			expr: "edge.getMultiReturn().blockTimestampLast",
			expectedType: "sol_int",
			mocks: { getMultiReturn: multiReturnResult },
			expectedValue: BigInt(1709251200),
		},

		// comparisons on nested fields
		{
			label: "deeply nested rate > 0",
			expr: "edge.getNestedDeep().inner.config.rate > solInt(0)",
			expectedType: "bool",
			mocks: { getNestedDeep: nestedDeepResult },
			expectedValue: true,
		},
		{
			label: "multi-return reserve0 > reserve1",
			expr: "edge.getMultiReturn().reserve0 > edge.getMultiReturn().reserve1",
			expectedType: "bool",
			mocks: { getMultiReturn: multiReturnResult },
			expectedValue: true,
		},

		// ternary on deeply nested boolean
		{
			label: "ternary: nested bool condition → nested numeric branches",
			expr: "edge.getNestedDeep().inner.config.active ? edge.getNestedDeep().inner.config.rate : solInt(0)",
			expectedType: "sol_int",
			mocks: { getNestedDeep: nestedDeepResult },
			expectedValue: 1500000n,
		},

		// arithmetic on multi-return struct fields
		{
			label: "arithmetic: reserve0 + reserve1 total liquidity",
			expr: "edge.getMultiReturn().reserve0 + edge.getMultiReturn().reserve1",
			expectedType: "sol_int",
			mocks: { getMultiReturn: multiReturnResult },
			expectedValue: 800000000000000n,
		},

		// cel.bind on nested struct
		{
			label: "cel.bind: bind nested config, check rate threshold",
			expr: "cel.bind(rate, edge.getNestedDeep().inner.config.rate, rate > solInt(1000000) || edge.getNestedDeep().inner.config.active)",
			expectedType: "bool",
			mocks: { getNestedDeep: nestedDeepResult },
			expectedValue: true,
		},

		// combined: nested address comparison + nested bool
		{
			label: "combined: nested address field matches context",
			expr: "edge.getNestedDeep().inner.token == user",
			expectedType: "bool",
			mocks: { getNestedDeep: nestedDeepResult },
			context: { user: TOKEN_A },
			expectedValue: true,
		},

		// invalid
		{
			label: "invalid: edge.getNestedDeep().inner.config.nonExistent",
			expr: "edge.getNestedDeep().inner.config.nonExistent",
			expectedType: "",
			invalid: true,
			minDiagnostics: 1,
		},
		{
			label: "invalid: edge.getAccount() missing required address arg",
			expr: "edge.getAccount()",
			expectedType: "",
			invalid: true,
			minDiagnostics: 1,
		},
	],
});
