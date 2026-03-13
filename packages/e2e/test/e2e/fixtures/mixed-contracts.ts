import {
	aaveV3Pool,
	compoundV3Comet,
	makerdaoVat,
} from "@seljs-internal/fixtures";

import { defineFixtureGroup } from "../helpers.js";

const aaveAbi = aaveV3Pool.abi;
const compoundAbi = compoundV3Comet.abi;
const makerAbi = makerdaoVat.abi;

// Tier 4 uses an array-form mock for getReserveData
const tier4ReserveData = [
	// configuration (tuple)
	{ data: 12345n },

	// liquidityIndex
	1000000000000000000000000000n,

	// currentLiquidityRate
	50000000000000000000000000n,

	// variableBorrowIndex
	1000000000000000000000000000n,

	// currentVariableBorrowRate
	70000000000000000000000000n,

	// currentStableBorrowRate
	80000000000000000000000000n,

	// lastUpdateTimestamp
	1700000000n,

	// id
	1n,

	// aTokenAddress
	"0x0000000000000000000000000000000000000010",

	// stableDebtTokenAddress
	"0x0000000000000000000000000000000000000011",

	// variableDebtTokenAddress
	"0x0000000000000000000000000000000000000012",

	// interestRateStrategyAddress
	"0x0000000000000000000000000000000000000013",

	// accruedToTreasury
	0n,

	// unbacked
	0n,

	// isolationModeTotalDebt
	0n,
];

const tier5UserAccountData = [
	// totalCollateralBase
	500000000000n,

	// totalDebtBase
	200000000000n,

	// availableBorrowsBase
	100000000000n,

	// currentLiquidationThreshold
	8000n,

	// ltv
	7500n,

	// healthFactor (2e18)
	2000000000000000000n,
];

export const mixedContractsFixtures = defineFixtureGroup({
	name: "Mixed Contracts (Aave + Compound)",
	contracts: {
		pool: { abi: aaveAbi, address: aaveV3Pool.address },
		comet: { abi: compoundAbi, address: compoundV3Comet.address },
		vat: { abi: makerAbi, address: makerdaoVat.address },
	},
	context: {
		user: "sol_address",
		asset: "sol_address",
	},
	cases: [
		{
			expr: "pool.getReserveData(asset).currentLiquidityRate > 0",
			expectedType: "bool",
			mocks: { getReserveData: tier4ReserveData },
			context: {
				user: "0x0000000000000000000000000000000000000001",
				asset: "0x0000000000000000000000000000000000000001",
			},
			expectedValue: true,
		},
		{
			expr: "comet.getSupplyRate(solInt(800000000000000000)) > solInt(0)",
			expectedType: "bool",
			mocks: { getSupplyRate: 50000n },
			expectedValue: true,
		},
		{
			// bytes32 cast not supported — call collector only recognizes uint256/u256 scalar casts
			label:
				"vat.ilks(bytes32(...)) — bytes cast not supported by call collector",
			expr: 'vat.ilks(bytes32("0x4554482d41000000000000000000000000000000000000000000000000000000")).rate',
			expectedType: "",
			invalid: true,
			minDiagnostics: 1,
		},

		{
			expr: "pool.getUserAccountData(user).healthFactor > 1000000000000000000",
			expectedType: "bool",
			mocks: { getUserAccountData: tier5UserAccountData },
			context: {
				user: "0x0000000000000000000000000000000000000002",
				asset: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
			},
			expectedValue: true,
		},
		{
			expr: "comet.isLiquidatable(user) == false",
			expectedType: "bool",
			mocks: { isLiquidatable: false },
			context: {
				user: "0x0000000000000000000000000000000000000002",
				asset: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
			},
			expectedValue: true,
		},

		{
			label:
				"comet.getSupplyRate(comet.getUtilization()) — multi-round nested call",
			expr: "comet.getSupplyRate(comet.getUtilization())",
			expectedType: "sol_int",
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
			expectedValue: 50000n,
			expectedRounds: 2,
		},

		// cross-contract: struct field (uint256) vs direct return (uint256)
		{
			label:
				"cross-contract struct field vs direct return — uint256 > uint256 same type",
			expr: "pool.getReserveData(asset).currentLiquidityRate > comet.getSupplyRate(solInt(800000000000000000))",
			expectedType: "bool",
			mocks: {
				getReserveData: tier4ReserveData,
				getSupplyRate: 50000n,
			},
			context: {
				user: "0x0000000000000000000000000000000000000001",
				asset: "0x0000000000000000000000000000000000000001",
			},
			expectedValue: true,
		},

		// cross-contract: struct field (uint256) vs direct uint256 return
		{
			label:
				"cross-contract struct field vs uint256 return — uint256 > uint256 same type",
			expr: "pool.getUserAccountData(user).healthFactor > comet.borrowBalanceOf(user)",
			expectedType: "bool",
			mocks: {
				getUserAccountData: tier5UserAccountData,
				borrowBalanceOf: 200000000000n,
			},
			context: {
				user: "0x0000000000000000000000000000000000000002",
				asset: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
			},
			expectedValue: true,
		},

		// logical OR across contracts — bool || bool
		{
			label:
				"logical OR across contracts — bool operators with mixed contract calls",
			expr: "comet.isLiquidatable(user) || pool.getUserAccountData(user).healthFactor > 1000000000000000000",
			expectedType: "bool",
			mocks: {
				isLiquidatable: false,
				getUserAccountData: tier5UserAccountData,
			},
			context: {
				user: "0x0000000000000000000000000000000000000002",
				asset: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
			},
			expectedValue: true,
		},

		// struct field compared with uint256 cast — uint256 > uint256 same type
		{
			label:
				"cross-contract struct field vs uint256 cast — uint256 > uint256 same type",
			expr: "pool.getReserveData(asset).currentLiquidityRate > solInt(0)",
			expectedType: "bool",
			mocks: { getReserveData: tier4ReserveData },
			context: {
				user: "0x0000000000000000000000000000000000000001",
				asset: "0x0000000000000000000000000000000000000001",
			},
			expectedValue: true,
		},

		{
			// call collector does not recognize []-wrapped rcall nodes as dependencies
			label:
				"pool.getReserveData(pool.getReservesList()[0]) — index operator dependency",
			expr: "pool.getReserveData(pool.getReservesList()[0]).currentLiquidityRate",
			expectedType: "sol_int",
		},

		// complex: cel.bind with cross-contract struct field + boolean
		{
			label:
				"cel.bind: struct field bound, used in compound boolean with other contract",
			expr: "cel.bind(hf, pool.getUserAccountData(user).healthFactor, hf > solInt(1000000000000000000) && !comet.isLiquidatable(user))",
			expectedType: "bool",
			mocks: {
				getUserAccountData: tier5UserAccountData,
				isLiquidatable: false,
			},
			context: {
				user: "0x0000000000000000000000000000000000000002",
				asset: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
			},
			expectedValue: true,
		},

		// complex: ternary with struct field condition, cross-contract branches
		{
			label: "ternary: struct field condition → cross-contract branches",
			expr: "pool.getUserAccountData(user).healthFactor > solInt(1500000000000000000) ? pool.getReserveData(asset).currentLiquidityRate : comet.getSupplyRate(solInt(800000000000000000))",
			expectedType: "sol_int",
			mocks: {
				getUserAccountData: tier5UserAccountData,
				getReserveData: tier4ReserveData,
				getSupplyRate: 50000n,
			},
			context: {
				user: "0x0000000000000000000000000000000000000002",
				asset: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
			},
			expectedValue: 50000000000000000000000000n,
		},

		// complex: arithmetic on struct fields from same call
		{
			label: "arithmetic on struct fields: collateral - debt",
			expr: "pool.getUserAccountData(user).totalCollateralBase - pool.getUserAccountData(user).totalDebtBase",
			expectedType: "sol_int",
			mocks: { getUserAccountData: tier5UserAccountData },
			context: {
				user: "0x0000000000000000000000000000000000000002",
				asset: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
			},
			expectedValue: 300000000000n,
		},

		// complex: multi-round nested call wrapped in cel.bind
		{
			label: "cel.bind + nested call: bind multi-round result, compare",
			expr: "cel.bind(rate, comet.getSupplyRate(comet.getUtilization()), rate > solInt(0))",
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

		// complex: ternary string output based on cross-contract boolean
		{
			label: "ternary: cross-contract boolean → string labels",
			expr: 'pool.getUserAccountData(user).healthFactor > solInt(1000000000000000000) && !comet.isLiquidatable(user) ? "safe" : "at risk"',
			expectedType: "string",
			mocks: {
				getUserAccountData: tier5UserAccountData,
				isLiquidatable: false,
			},
			context: {
				user: "0x0000000000000000000000000000000000000002",
				asset: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
			},
			expectedValue: "safe",
		},

		// complex: arithmetic across contracts — struct field minus direct return
		{
			label: "arithmetic: struct field - direct return across contracts",
			expr: "pool.getUserAccountData(user).totalCollateralBase - comet.borrowBalanceOf(user)",
			expectedType: "sol_int",
			mocks: {
				getUserAccountData: tier5UserAccountData,
				borrowBalanceOf: 100000000000n,
			},
			context: {
				user: "0x0000000000000000000000000000000000000002",
				asset: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
			},
			expectedValue: 400000000000n,
		},
	],
});
