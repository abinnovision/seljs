import { uniswapV3Pool } from "@seljs-internal/fixtures";

import { defineFixtureGroup } from "../helpers.js";

const abi = uniswapV3Pool.abi;

const slot0Result = [
	// sqrtPriceX96 (uint160)
	1405006820453684825457858541n,

	// tick (int24)
	202162,

	// observationIndex (uint16)
	788,

	// observationCardinality (uint16)
	900,

	// observationCardinalityNext (uint16)
	900,

	// feeProtocol (uint8)
	0,

	// unlocked (bool)
	true,
];

export const uniswapPoolFixtures = defineFixtureGroup({
	name: "Uniswap V3 Pool",
	contracts: {
		uniPool: { abi, address: uniswapV3Pool.address },
	},
	schema: {
		structs: [
			{
				name: "SEL_Struct_uniPool_slot0",
				fieldCount: 7,
				fields: [
					"sqrtPriceX96",
					"tick",
					"observationIndex",
					"observationCardinality",
					"observationCardinalityNext",
					"feeProtocol",
					"unlocked",
				],
			},
		],
	},
	cases: [
		{
			// expr is the bare call — typeAt at offset 14 (')') returns struct type
			expr: "uniPool.slot0()",
			expectedType: "SEL_Struct_uniPool_slot0",
			mocks: { slot0: slot0Result },
			completions: [
				{
					// completions after "uniPool." — offset 8 is 's' (start of slot0)
					offset: 8,
					includes: ["slot0"],
				},
			],
			typeAt: [
				{
					// offset 14 = ')' of "uniPool.slot0()" -> struct type
					offset: 14,
					type: "SEL_Struct_uniPool_slot0",
				},
			],
		},
		{
			expr: "uniPool.slot0().sqrtPriceX96",

			// uint160 maps to CEL "uint256"
			expectedType: "sol_int",
			mocks: { slot0: slot0Result },
			expectedValue: 1405006820453684825457858541n,
		},
		{
			expr: "uniPool.slot0().tick",

			// int24 maps to CEL "int256"
			expectedType: "sol_int",
			mocks: { slot0: slot0Result },
			expectedValue: BigInt(202162),
		},
		{
			expr: "uniPool.slot0().observationIndex",

			// uint16 maps to CEL "uint256"
			expectedType: "sol_int",
			mocks: { slot0: slot0Result },
			expectedValue: BigInt(788),
		},
		{
			expr: "uniPool.slot0().observationCardinality",
			expectedType: "sol_int",
			mocks: { slot0: slot0Result },
			expectedValue: BigInt(900),
		},
		{
			expr: "uniPool.slot0().unlocked",
			expectedType: "bool",
			mocks: { slot0: slot0Result },
			expectedValue: true,
		},

		// struct field (uint256) vs uint256 cast — same type
		{
			label: "struct field vs uint256 cast — uint256 > uint256 same type",
			expr: "uniPool.slot0().sqrtPriceX96 > solInt(0)",
			expectedType: "bool",
			mocks: { slot0: slot0Result },
			expectedValue: true,
		},

		// struct field vs bare literal — int256 > int (cross-type)
		{
			expr: "uniPool.slot0().tick > 0",
			expectedType: "bool",
			mocks: { slot0: slot0Result },
			expectedValue: true,
		},

		// arithmetic between struct fields — int256 + uint256 (cross-type)
		{
			expr: "uniPool.slot0().tick + uniPool.slot0().observationIndex",
			expectedType: "sol_int",
			mocks: { slot0: slot0Result },
			expectedValue: BigInt(202162) + BigInt(788),
		},

		{
			label: "invalid: uniPool.slot0().nonExistentField",
			expr: "uniPool.slot0().nonExistentField",
			expectedType: "",
			invalid: true,
			minDiagnostics: 1,
		},
	],
});
