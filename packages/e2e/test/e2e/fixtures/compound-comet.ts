import { compoundV3Comet } from "@seljs-internal/fixtures";

import { defineFixtureGroup } from "../helpers.js";

const abi = compoundV3Comet.abi;

const assetInfoResult = {
	offset: 0,
	asset: "0xc00e94Cb662C3520282E6f5717214004A7f26888",
	priceFeed: "0xdbd020CAeF83eFd542f4De03e3cF0C28A4428bd5",
	scale: 1000000000000000000n,
	borrowCollateralFactor: 650000000000000000n,
	liquidateCollateralFactor: 700000000000000000n,
	liquidationFactor: 930000000000000000n,
	supplyCap: 100000000000000000000000n,
};

const USER = "0x0000000000000000000000000000000000000001";

export const compoundCometFixtures = defineFixtureGroup({
	name: "Compound V3 Comet",
	contracts: {
		comet: { abi, address: compoundV3Comet.address },
	},
	context: {
		user: "sol_address",
	},
	schema: {
		structs: [
			{
				name: "SEL_Struct_comet_getAssetInfo",
				fieldCount: 8,
				fields: [
					"offset",
					"asset",
					"priceFeed",
					"scale",
					"borrowCollateralFactor",
					"liquidateCollateralFactor",
					"liquidationFactor",
					"supplyCap",
				],
			},
		],
	},
	cases: [
		{
			expr: "comet.getUtilization()",
			expectedType: "sol_int",
			mocks: { getUtilization: 800000000000000000n },
			expectedValue: 800000000000000000n,
			completions: [
				{
					// completions after "comet." — offset 6 is 'g'
					offset: 6,
					includes: [
						"getUtilization",
						"isLiquidatable",
						"borrowBalanceOf",
						"getAssetInfo",
						"getSupplyRate",
					],
				},
			],
		},
		{
			expr: "comet.isLiquidatable(user)",
			expectedType: "bool",
			mocks: { isLiquidatable: false },
			context: { user: USER },
			expectedValue: false,
		},
		{
			expr: "comet.borrowBalanceOf(user)",
			expectedType: "sol_int",
			mocks: { borrowBalanceOf: 1000000n },
			context: { user: USER },
			expectedValue: 1000000n,
		},

		{
			// expr is the bare call — offset 29 (EOF) returns struct type via typeAt
			expr: "comet.getAssetInfo(solInt(0))",
			expectedType: "SEL_Struct_comet_getAssetInfo",
			mocks: { getAssetInfo: assetInfoResult },
			typeAt: [
				{
					// offset 29 = EOF of "comet.getAssetInfo(solInt(0))" -> struct type
					offset: 29,
					type: "SEL_Struct_comet_getAssetInfo",
				},
			],
		},
		{
			expr: "comet.getAssetInfo(solInt(0)).borrowCollateralFactor",

			// uint64 maps to CEL "uint256"
			expectedType: "sol_int",
			mocks: { getAssetInfo: assetInfoResult },
			expectedValue: 650000000000000000n,
		},
		{
			expr: "comet.getAssetInfo(solInt(0)).asset",

			// address maps to CEL "address"
			expectedType: "sol_address",
			mocks: { getAssetInfo: assetInfoResult },
			expectedValue: "0xc00e94cb662c3520282e6f5717214004a7f26888",
		},
		{
			expr: "comet.getAssetInfo(solInt(0)).supplyCap",
			expectedType: "sol_int",
			mocks: { getAssetInfo: assetInfoResult },
			expectedValue: 100000000000000000000000n,
		},

		// struct field (uint256) vs uint256 cast — same type
		{
			label: "struct field vs uint256 cast — uint256 > uint256 same type",
			expr: "comet.getAssetInfo(solInt(0)).borrowCollateralFactor > solInt(0)",
			expectedType: "bool",
			mocks: { getAssetInfo: assetInfoResult },
			expectedValue: true,
		},

		// direct uint256 return vs uint256 cast — same type comparison
		{
			expr: "comet.getUtilization() > solInt(0)",
			expectedType: "bool",
			mocks: { getUtilization: 800000000000000000n },
			expectedValue: true,
		},

		// direct uint256 return vs bare literal — uint256 > int (cross-type)
		{
			label: "direct uint256 return vs bare literal — uint256 > int cross-type",
			expr: "comet.getUtilization() > 0",
			expectedType: "bool",
			mocks: { getUtilization: 800000000000000000n },
			expectedValue: true,
		},

		// boolean negation
		{
			expr: "!comet.isLiquidatable(user)",
			expectedType: "bool",
			mocks: { isLiquidatable: false },
			context: { user: USER },
			expectedValue: true,
		},

		// boolean equality with literal
		{
			expr: "comet.isLiquidatable(user) == false",
			expectedType: "bool",
			mocks: { isLiquidatable: false },
			context: { user: USER },
			expectedValue: true,
		},

		// cel.bind on struct — bind asset info, access multiple fields
		{
			label:
				"cel.bind: bind asset info struct, compare borrow vs liquidate factor",
			expr: "cel.bind(info, comet.getAssetInfo(solInt(0)), info.borrowCollateralFactor < info.liquidateCollateralFactor)",
			expectedType: "bool",
			mocks: { getAssetInfo: assetInfoResult },
			expectedValue: true,
		},

		// struct field-to-field comparison
		{
			label:
				"struct field comparison: borrowCollateralFactor < liquidateCollateralFactor",
			expr: "comet.getAssetInfo(solInt(0)).borrowCollateralFactor < comet.getAssetInfo(solInt(0)).liquidateCollateralFactor",
			expectedType: "bool",
			mocks: { getAssetInfo: assetInfoResult },
			expectedValue: true,
		},

		// struct address field comparison
		{
			label: "struct address field equality with context",
			expr: "comet.getAssetInfo(solInt(0)).asset == user",
			expectedType: "bool",
			mocks: { getAssetInfo: assetInfoResult },
			context: { user: "0xc00e94Cb662C3520282E6f5717214004A7f26888" },
			expectedValue: true,
		},

		// ternary with struct field condition
		{
			label: "ternary: supply cap remaining label",
			expr: 'comet.getAssetInfo(solInt(0)).supplyCap > solInt(0) ? "accepting deposits" : "capped"',
			expectedType: "string",
			mocks: { getAssetInfo: assetInfoResult },
			expectedValue: "accepting deposits",
		},

		// multi-round nested call with comparison
		{
			label: "multi-round: getSupplyRate(getUtilization()) > threshold",
			expr: "comet.getSupplyRate(comet.getUtilization()) > solInt(10000)",
			expectedType: "bool",
			mocks: {
				getUtilization: 800000000000000000n,
				getSupplyRate: (args: readonly unknown[]) => {
					const utilization = args[0] as bigint;
					if (utilization === 800000000000000000n) {
						return 50000n;
					}

					return 0n;
				},
			},
			expectedValue: true,
			expectedRounds: 2,
		},

		/*
		 * === Deferred call argument patterns (type-check only) ===
		 * See: https://github.com/abinnovision/sel/issues/45
		 */
		{
			label:
				"deferred: arithmetic on struct field as call arg — getAssetInfo(offset + 1)",
			expr: "comet.getAssetInfo(comet.getAssetInfo(solInt(0)).offset + solInt(1)).asset",
			expectedType: "sol_address",
			mocks: {
				getAssetInfo: (args: readonly unknown[]) => {
					// uint8 args are decoded as number by viem, not bigint
					if (Number(args[0]) === 1) {
						return {
							...assetInfoResult,
							asset: "0x1234567890abcdef1234567890abcdef12345678",
						};
					}

					return assetInfoResult;
				},
			},
			expectedValue: "0x1234567890abcdef1234567890abcdef12345678",
			expectedRounds: 1,
		},
		{
			label:
				"deferred: struct field as call arg — getSupplyRate(getAssetInfo().scale)",
			expr: "comet.getSupplyRate(comet.getAssetInfo(solInt(0)).scale)",
			expectedType: "sol_int",
			mocks: {
				getAssetInfo: assetInfoResult,
				getSupplyRate: (args: readonly unknown[]) => {
					if (args[0] === assetInfoResult.scale) {
						return 50000000000n;
					}

					return 0n;
				},
			},
			expectedValue: 50000000000n,
			expectedRounds: 1,
		},

		{
			label: "invalid: comet.getAssetInfo(solInt(0)).unknownField",
			expr: "comet.getAssetInfo(solInt(0)).unknownField",
			expectedType: "",
			invalid: true,
			minDiagnostics: 1,
		},
		{
			label: "invalid: comet.isLiquidatable() missing required address arg",
			expr: "comet.isLiquidatable()",
			expectedType: "",
			invalid: true,
			minDiagnostics: 1,
		},
	],
});
