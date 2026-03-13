import { aaveV3Pool } from "@seljs-internal/fixtures";

import { defineFixtureGroup } from "../helpers.js";

const abi = aaveV3Pool.abi;

const reserveDataResult = {
	configuration: {
		data: 7237005577332262213973186563042994240829374041602535252466099000494570602496n,
	},
	liquidityIndex: 1000000000000000000000000000n,
	currentLiquidityRate: 35000000000000000000000000n,
	variableBorrowIndex: 1010000000000000000000000000n,
	currentVariableBorrowRate: 40000000000000000000000000n,
	currentStableBorrowRate: 0n,
	lastUpdateTimestamp: 1709251200,
	id: 0,
	aTokenAddress: "0xBcca60bB61934080951369a648Fb03DF4F96263C",
	stableDebtTokenAddress: "0x531842cEbbdD378f8ee36D171d6cC9C4fcf475Ec",
	variableDebtTokenAddress: "0x619beb58998eD2278e08620f97007e1116D5D25b",
	interestRateStrategyAddress: "0x9b34E3e183c9b0d1a08fF57a8fb59c821616295f",
	accruedToTreasury: 0n,
	unbacked: 0n,
	isolationModeTotalDebt: 0n,
};

const userAccountDataResult = [
	// totalCollateralBase
	100000000000000000000n,

	// totalDebtBase
	50000000000000000000n,

	// availableBorrowsBase
	30000000000000000000n,

	// currentLiquidationThreshold
	8000n,

	// ltv
	7500n,

	// healthFactor (2.0)
	2000000000000000000n,
];

const reservesList = [
	"0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
	"0x6B175474E89094C44Da98b954EedeAC495271d0F",
] as const;

const USER = "0x0000000000000000000000000000000000000001";
const ASSET = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";

export const aavePoolFixtures = defineFixtureGroup({
	name: "Aave V3 Pool",
	contracts: {
		pool: { abi, address: aaveV3Pool.address },
	},
	context: {
		user: "sol_address",
		asset: "sol_address",
	},
	schema: {
		structs: [
			{
				name: "SEL_Struct_pool_getReserveData",
				fieldCount: 15,
				fields: [
					"currentLiquidityRate",
					"aTokenAddress",
					"liquidityIndex",
					"variableBorrowIndex",
					"accruedToTreasury",
					"unbacked",
					"isolationModeTotalDebt",
				],
			},
			{
				name: "SEL_Struct_pool_getUserAccountData",
				fieldCount: 6,
				fields: [
					"totalCollateralBase",
					"totalDebtBase",
					"availableBorrowsBase",
					"currentLiquidationThreshold",
					"ltv",
					"healthFactor",
				],
			},
		],
	},
	cases: [
		{
			expr: "pool.getReservesList()",
			expectedType: "list<sol_address>",
			mocks: { getReservesList: reservesList },
			context: { user: USER, asset: ASSET },
			expectedValue: [
				"0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
				"0x6b175474e89094c44da98b954eedeac495271d0f",
			],
			completions: [
				{
					// completions after "pool." — offset 5 is 'g' (start of function names)
					offset: 5,
					includes: ["getReservesList", "getReserveData", "getUserAccountData"],
				},
			],
		},

		{
			// expr is the bare call — offset 26 (EOF) returns struct type via typeAt
			expr: "pool.getReserveData(asset)",
			expectedType: "SEL_Struct_pool_getReserveData",
			mocks: { getReserveData: reserveDataResult },
			context: { user: USER, asset: ASSET },
			typeAt: [
				{
					// offset 26 = EOF of "pool.getReserveData(asset)" -> struct type
					offset: 26,
					type: "SEL_Struct_pool_getReserveData",
				},
			],
		},
		{
			expr: "pool.getReserveData(asset).currentLiquidityRate",

			// uint128 maps to CEL "uint256"
			expectedType: "sol_int",
			mocks: { getReserveData: reserveDataResult },
			context: { user: USER, asset: ASSET },
			expectedValue: 35000000000000000000000000n,
		},
		{
			expr: "pool.getReserveData(asset).aTokenAddress",

			// address maps to CEL "address"
			expectedType: "sol_address",
			mocks: { getReserveData: reserveDataResult },
			context: { user: USER, asset: ASSET },
			expectedValue: "0xbcca60bb61934080951369a648fb03df4f96263c",
		},
		{
			expr: "pool.getReserveData(asset).variableDebtTokenAddress",
			expectedType: "sol_address",
			mocks: { getReserveData: reserveDataResult },
			context: { user: USER, asset: ASSET },
			expectedValue: "0x619beb58998ed2278e08620f97007e1116d5d25b",
		},

		{
			expr: "pool.getUserAccountData(user)",
			expectedType: "SEL_Struct_pool_getUserAccountData",
			mocks: { getUserAccountData: userAccountDataResult },
			context: { user: USER, asset: ASSET },
			typeAt: [
				{
					// offset 29 = EOF of "pool.getUserAccountData(user)" (length=29)
					offset: 29,
					type: "SEL_Struct_pool_getUserAccountData",
				},
			],
		},
		{
			expr: "pool.getUserAccountData(user).healthFactor",

			// uint256 maps to CEL "uint256"
			expectedType: "sol_int",
			mocks: { getUserAccountData: userAccountDataResult },
			context: { user: USER, asset: ASSET },
			expectedValue: 2000000000000000000n,
		},
		{
			expr: "pool.getUserAccountData(user).ltv",
			expectedType: "sol_int",
			mocks: { getUserAccountData: userAccountDataResult },
			context: { user: USER, asset: ASSET },
			expectedValue: 7500n,
		},

		// whole struct return — asserts all fields are properly unwrapped (not wrapped in { value: ... })
		{
			label: "whole struct return — fields unwrapped to primitives",
			expr: "pool.getUserAccountData(user)",
			expectedType: "SEL_Struct_pool_getUserAccountData",
			mocks: { getUserAccountData: userAccountDataResult },
			context: { user: USER, asset: ASSET },
			expectedValue: {
				totalCollateralBase: 100000000000000000000n,
				totalDebtBase: 50000000000000000000n,
				availableBorrowsBase: 30000000000000000000n,
				currentLiquidationThreshold: 8000n,
				ltv: 7500n,
				healthFactor: 2000000000000000000n,
			},
		},

		// nested struct field access — configuration.data through nested struct
		{
			label: "nested struct field access — configuration.data",
			expr: "pool.getReserveData(asset).configuration.data",
			expectedType: "sol_int",
			mocks: { getReserveData: reserveDataResult },
			context: { user: USER, asset: ASSET },
			expectedValue:
				7237005577332262213973186563042994240829374041602535252466099000494570602496n,
		},

		// whole struct return with nested struct — asserts nested fields are unwrapped
		{
			label: "whole struct with nested struct — all fields unwrapped",
			expr: "pool.getReserveData(asset)",
			expectedType: "SEL_Struct_pool_getReserveData",
			mocks: { getReserveData: reserveDataResult },
			context: { user: USER, asset: ASSET },
			expectedValue: {
				configuration: {
					data: 7237005577332262213973186563042994240829374041602535252466099000494570602496n,
				},
				liquidityIndex: 1000000000000000000000000000n,
				currentLiquidityRate: 35000000000000000000000000n,
				variableBorrowIndex: 1010000000000000000000000000n,
				currentVariableBorrowRate: 40000000000000000000000000n,
				currentStableBorrowRate: 0n,
				lastUpdateTimestamp: 1709251200n,
				id: 0n,
				aTokenAddress: "0xbcca60bb61934080951369a648fb03df4f96263c",
				stableDebtTokenAddress: "0x531842cebbdd378f8ee36d171d6cc9c4fcf475ec",
				variableDebtTokenAddress: "0x619beb58998ed2278e08620f97007e1116d5d25b",
				interestRateStrategyAddress:
					"0x9b34e3e183c9b0d1a08ff57a8fb59c821616295f",
				accruedToTreasury: 0n,
				unbacked: 0n,
				isolationModeTotalDebt: 0n,
			},
		},

		// struct field (uint256) vs uint256 cast — same type
		{
			label: "struct field vs uint256 cast — uint256 > uint256 same type",
			expr: "pool.getReserveData(asset).currentLiquidityRate > solInt(0)",
			expectedType: "bool",
			mocks: { getReserveData: reserveDataResult },
			context: { user: USER, asset: ASSET },
			expectedValue: true,
		},

		// struct field vs struct field from same call — uint256 < uint256
		{
			expr: "pool.getUserAccountData(user).ltv < pool.getUserAccountData(user).currentLiquidationThreshold",
			expectedType: "bool",
			mocks: { getUserAccountData: userAccountDataResult },
			context: { user: USER, asset: ASSET },
			expectedValue: true,
		},

		// arithmetic between struct fields — uint256 + uint256
		{
			expr: "pool.getReserveData(asset).liquidityIndex + pool.getReserveData(asset).currentLiquidityRate",
			expectedType: "sol_int",
			mocks: { getReserveData: reserveDataResult },
			context: { user: USER, asset: ASSET },
			expectedValue:
				1000000000000000000000000000n + 35000000000000000000000000n,
		},

		// struct field compared with bare literal — uint256 > int (cross-type)
		{
			expr: "pool.getUserAccountData(user).healthFactor > 1000000000000000000",
			expectedType: "bool",
			mocks: { getUserAccountData: userAccountDataResult },
			context: { user: USER, asset: ASSET },
			expectedValue: true,
		},

		// list macros on getReservesList() return
		{
			label: "reserves list size",
			expr: "pool.getReservesList().size()",
			expectedType: "int",
			mocks: { getReservesList: reservesList },
			context: { user: USER, asset: ASSET },
			expectedValue: 2n,
		},
		{
			label: "reserves list exists — asset in list",
			expr: "pool.getReservesList().exists(a, a == asset)",
			expectedType: "bool",
			mocks: { getReservesList: reservesList },
			context: { user: USER, asset: ASSET },
			expectedValue: true,
		},
		{
			label: "reserves list exists — asset not in list",
			expr: "pool.getReservesList().exists(a, a == user)",
			expectedType: "bool",
			mocks: { getReservesList: reservesList },
			context: { user: USER, asset: ASSET },
			expectedValue: false,
		},
		{
			label: "reserves list filter + size",
			expr: "pool.getReservesList().filter(a, a != asset).size()",
			expectedType: "int",
			mocks: { getReservesList: reservesList },
			context: { user: USER, asset: ASSET },
			expectedValue: 1n,
		},
		{
			label: "reserves list all — none is zero address",
			expr: 'pool.getReservesList().all(a, a != solAddress("0x0000000000000000000000000000000000000000"))',
			expectedType: "bool",
			mocks: { getReservesList: reservesList },
			context: { user: USER, asset: ASSET },
			expectedValue: true,
		},
		{
			label: "reserves list index access [0]",
			expr: "pool.getReservesList()[0]",
			expectedType: "sol_address",
			mocks: { getReservesList: reservesList },
			context: { user: USER, asset: ASSET },
			expectedValue: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
		},

		// cel.bind with struct fields — real-world health factor pattern
		{
			label: "cel.bind: bind healthFactor, use in compound condition",
			expr: "cel.bind(hf, pool.getUserAccountData(user).healthFactor, hf > solInt(1000000000000000000) && hf < solInt(3000000000000000000))",
			expectedType: "bool",
			mocks: { getUserAccountData: userAccountDataResult },
			context: { user: USER, asset: ASSET },
			expectedValue: true,
		},
		{
			label: "struct field arithmetic: net worth = collateral - debt",
			expr: "pool.getUserAccountData(user).totalCollateralBase - pool.getUserAccountData(user).totalDebtBase",
			expectedType: "sol_int",
			mocks: { getUserAccountData: userAccountDataResult },
			context: { user: USER, asset: ASSET },
			expectedValue: 50000000000000000000n,
		},
		{
			label: "ternary: healthy position label from struct fields",
			expr: 'pool.getUserAccountData(user).healthFactor > solInt(1500000000000000000) ? "healthy" : "at risk"',
			expectedType: "string",
			mocks: { getUserAccountData: userAccountDataResult },
			context: { user: USER, asset: ASSET },
			expectedValue: "healthy",
		},
		{
			label: "combined: ltv < threshold AND healthFactor > 1",
			expr: "pool.getUserAccountData(user).ltv < pool.getUserAccountData(user).currentLiquidationThreshold && pool.getUserAccountData(user).healthFactor > solInt(1000000000000000000)",
			expectedType: "bool",
			mocks: { getUserAccountData: userAccountDataResult },
			context: { user: USER, asset: ASSET },
			expectedValue: true,
		},

		/*
		 * === Dynamic call argument limitations ===
		 *
		 * The checker correctly infers types for all these patterns, but the
		 * runtime call collector extracts contract calls statically from the AST.
		 * When a call argument is a runtime-only value (macro iteration variable,
		 * cel.bind variable, index on list return, ternary result, arithmetic
		 * result), ABI encoding fails because the value doesn't exist at
		 * collection time. These are type-check-only tests.
		 *
		 * See: https://github.com/abinnovision/sel/issues/45
		 */

		// comprehension macros with contract call in body
		{
			label:
				"map: getReservesList().map(x, getReserveData(x)) — type-check only",
			expr: "pool.getReservesList().map(x, pool.getReserveData(x))",
			expectedType: "list<SEL_Struct_pool_getReserveData>",
		},
		{
			label: "map: extract field from mapped contract call — type-check only",
			expr: "pool.getReservesList().map(x, pool.getReserveData(x).currentLiquidityRate)",
			expectedType: "list<sol_int>",
		},
		{
			label: "filter: contract call in predicate — type-check only",
			expr: "pool.getReservesList().filter(x, pool.getReserveData(x).currentLiquidityRate > solInt(0))",
			expectedType: "list<sol_address>",
		},
		{
			label: "exists: contract call in predicate — type-check only",
			expr: "pool.getReservesList().exists(x, pool.getReserveData(x).currentLiquidityRate > solInt(0))",
			expectedType: "bool",
		},
		{
			label: "all: contract call in predicate — type-check only",
			expr: "pool.getReservesList().all(x, pool.getReserveData(x).currentLiquidityRate > solInt(0))",
			expectedType: "bool",
		},

		// chained: map + further processing
		{
			label: "map + size: count reserves with rate data — type-check only",
			expr: "pool.getReservesList().map(x, pool.getReserveData(x).currentLiquidityRate).size()",
			expectedType: "int",
		},
		{
			label: "exists_one: exactly one reserve with zero rate — type-check only",
			expr: "pool.getReservesList().exists_one(x, pool.getReserveData(x).currentStableBorrowRate == solInt(0))",
			expectedType: "bool",
		},

		// cel.bind variable as contract call argument
		{
			label: "cel.bind: bound value as call arg — type-check only",
			expr: "cel.bind(first, pool.getReservesList()[0], pool.getReserveData(first).currentLiquidityRate)",
			expectedType: "sol_int",
		},
		{
			label: "cel.bind: bound struct field as call arg — type-check only",
			expr: "cel.bind(aToken, pool.getReserveData(asset).aTokenAddress, pool.getReserveData(aToken).liquidityIndex)",
			expectedType: "sol_int",
		},

		// index on list return as contract call argument
		{
			label: "index on list return as call arg — type-check only",
			expr: "pool.getReserveData(pool.getReservesList()[0]).currentLiquidityRate",
			expectedType: "sol_int",
		},

		// struct field as contract call argument
		{
			label:
				"struct field as call arg — getReserveData(getUserAccountData().healthFactor) (contrived) — type-check only",
			expr: "pool.getReserveData(pool.getReservesList()[1]).aTokenAddress",
			expectedType: "sol_address",
		},

		// short-circuit: calls are still collected and executed (wasteful but correct)
		{
			label: "short-circuit AND: false && contract call — call still executes",
			expr: "false && pool.getUserAccountData(user).healthFactor > solInt(0)",
			expectedType: "bool",
			mocks: { getUserAccountData: userAccountDataResult },
			context: { user: USER, asset: ASSET },
			expectedValue: false,
		},
		{
			label: "short-circuit OR: true || contract call — call still executes",
			expr: "true || pool.getUserAccountData(user).healthFactor > solInt(0)",
			expectedType: "bool",
			mocks: { getUserAccountData: userAccountDataResult },
			context: { user: USER, asset: ASSET },
			expectedValue: true,
		},

		{
			label: "invalid: pool.getReserveData() missing required arg",
			expr: "pool.getReserveData()",
			expectedType: "",
			invalid: true,
			minDiagnostics: 1,
		},
		{
			label: "invalid: pool.getReserveData(asset).nonExistentField",
			expr: "pool.getReserveData(asset).nonExistentField",
			expectedType: "",
			invalid: true,
			minDiagnostics: 1,
		},
	],
});
