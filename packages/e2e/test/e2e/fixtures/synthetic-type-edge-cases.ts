import { syntheticTypeEdgeCases } from "@seljs-internal/fixtures";

import { defineFixtureGroup } from "../helpers.js";

const abi = syntheticTypeEdgeCases.abi;
const ADDRESS = "0x00000000000000000000000000000000000000aa";

const TOKEN_A = "0x000000000000000000000000000000000000000a";
const TOKEN_B = "0x000000000000000000000000000000000000000b";

export const syntheticTypeEdgeCasesFixtures = defineFixtureGroup({
	name: "Synthetic Type Edge Cases",
	contracts: {
		types: { abi, address: ADDRESS },
	},
	schema: {
		structs: [
			{
				name: "SEL_Struct_types_getExoticWidths",
				fieldCount: 3,
				fields: ["price", "delta", "flags"],
			},
		],
	},
	cases: [
		// exotic integer widths — int24, uint160, int56, uint8
		{
			expr: "types.getExoticWidths(solInt(100))",
			expectedType: "SEL_Struct_types_getExoticWidths",
			mocks: {
				getExoticWidths: [
					// price (uint160)
					1405006820453684825457858541n,

					// delta (int56)
					-42n,

					// flags (uint8)
					255,
				],
			},
			completions: [
				{
					offset: 6,
					includes: [
						"getExoticWidths",
						"getAddresses",
						"getAmounts",
						"isActive",
						"getName",
					],
				},
			],
		},
		{
			expr: "types.getExoticWidths(solInt(100)).price",
			expectedType: "sol_int",
			mocks: {
				getExoticWidths: [1405006820453684825457858541n, -42n, 255],
			},
			expectedValue: 1405006820453684825457858541n,
		},
		{
			expr: "types.getExoticWidths(solInt(100)).delta",
			expectedType: "sol_int",
			mocks: {
				getExoticWidths: [1405006820453684825457858541n, -42n, 255],
			},
			expectedValue: -42n,
		},
		{
			expr: "types.getExoticWidths(solInt(100)).flags",
			expectedType: "sol_int",
			mocks: {
				getExoticWidths: [1405006820453684825457858541n, -42n, 255],
			},
			expectedValue: BigInt(255),
		},

		// address[] return
		{
			expr: "types.getAddresses()",
			expectedType: "list<sol_address>",
			mocks: { getAddresses: [TOKEN_A, TOKEN_B] },
			expectedValue: [TOKEN_A, TOKEN_B],
		},

		// uint256[] return
		{
			expr: "types.getAmounts()",
			expectedType: "list<sol_int>",
			mocks: { getAmounts: [100n, 200n, 300n] },
			expectedValue: [100n, 200n, 300n],
		},

		// simple bool return
		{
			expr: "types.isActive(solInt(1))",
			expectedType: "bool",
			mocks: { isActive: true },
			expectedValue: true,
		},
		{
			expr: "!types.isActive(solInt(1))",
			expectedType: "bool",
			mocks: { isActive: true },
			expectedValue: false,
		},

		// string return
		{
			expr: "types.getName()",
			expectedType: "string",
			mocks: { getName: "TestContract" },
			expectedValue: "TestContract",
		},

		// comparisons
		{
			label: "exotic width comparison — delta < 0",
			expr: "types.getExoticWidths(solInt(100)).delta < solInt(0)",
			expectedType: "bool",
			mocks: {
				getExoticWidths: [1405006820453684825457858541n, -42n, 255],
			},
			expectedValue: true,
		},

		// invalid — overloaded function with bytes32 input (unsupported cast)
		{
			label: "invalid: types.lookup(bytes32(...)) — bytes cast not supported",
			expr: 'types.lookup(bytes32("0x0000000000000000000000000000000000000000000000000000000000000001"))',
			expectedType: "",
			invalid: true,
			minDiagnostics: 1,
		},
		{
			label: "invalid: types.nonExistent()",
			expr: "types.nonExistent()",
			expectedType: "",
			invalid: true,
			minDiagnostics: 1,
		},
	],
});
