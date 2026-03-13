import { lidoSteth } from "@seljs-internal/fixtures";

import { defineFixtureGroup } from "../helpers.js";

const abi = lidoSteth.abi;

const USER = "0x0000000000000000000000000000000000000001";

const stakeLimitFullInfoResult = [
	// isStakingPaused
	false,

	// isStakingLimitSet
	true,

	// currentStakeLimit
	150000000000000000000000n,

	// maxStakeLimit
	150000000000000000000000n,

	// maxStakeLimitGrowthBlocks
	6400n,

	// prevStakeLimit
	150000000000000000000000n,

	// prevStakeBlockNumber
	19000000n,
];

const beaconStatResult = [
	// depositedValidators
	500000n,

	// beaconValidators
	499000n,

	// beaconBalance
	15968000000000000000000000n,
];

export const lidoStethFixtures = defineFixtureGroup({
	name: "Lido stETH",
	contracts: {
		steth: { abi, address: lidoSteth.address },
	},
	context: {
		user: "sol_address",
	},
	schema: {
		structs: [
			{
				name: "SEL_Struct_steth_getStakeLimitFullInfo",
				fieldCount: 7,
				fields: [
					"isStakingPaused",
					"isStakingLimitSet",
					"currentStakeLimit",
					"maxStakeLimit",
				],
			},
			{
				name: "SEL_Struct_steth_getBeaconStat",
				fieldCount: 3,
				fields: ["depositedValidators", "beaconValidators", "beaconBalance"],
			},
		],
	},
	cases: [
		{
			expr: "steth.name()",
			expectedType: "string",
			mocks: { name: "Liquid staked Ether 2.0" },
			expectedValue: "Liquid staked Ether 2.0",
			completions: [
				{
					offset: 6,
					includes: [
						"name",
						"symbol",
						"getTotalPooledEther",
						"getTotalShares",
						"getSharesByPooledEth",
						"getPooledEthByShares",
						"sharesOf",
						"isStakingPaused",
						"getBeaconStat",
					],
				},
			],
		},
		{
			expr: "steth.symbol()",
			expectedType: "string",
			mocks: { symbol: "stETH" },
			expectedValue: "stETH",
		},
		{
			expr: "steth.getTotalPooledEther()",
			expectedType: "sol_int",
			mocks: { getTotalPooledEther: 9600000000000000000000000n },
			expectedValue: 9600000000000000000000000n,
		},
		{
			expr: "steth.getTotalShares()",
			expectedType: "sol_int",
			mocks: { getTotalShares: 8500000000000000000000000n },
			expectedValue: 8500000000000000000000000n,
		},
		{
			expr: "steth.getSharesByPooledEth(solInt(1000000000000000000))",
			expectedType: "sol_int",
			mocks: { getSharesByPooledEth: 885416666666666666n },
			expectedValue: 885416666666666666n,
		},
		{
			expr: "steth.getPooledEthByShares(solInt(1000000000000000000))",
			expectedType: "sol_int",
			mocks: { getPooledEthByShares: 1129411764705882352n },
			expectedValue: 1129411764705882352n,
		},
		{
			expr: "steth.sharesOf(user)",
			expectedType: "sol_int",
			mocks: { sharesOf: 100000000000000000000n },
			context: { user: USER },
			expectedValue: 100000000000000000000n,
		},
		{
			expr: "steth.isStakingPaused()",
			expectedType: "bool",
			mocks: { isStakingPaused: false },
			expectedValue: false,
		},
		{
			expr: "steth.getBufferedEther()",
			expectedType: "sol_int",
			mocks: { getBufferedEther: 32000000000000000000n },
			expectedValue: 32000000000000000000n,
		},
		{
			expr: "steth.getCurrentStakeLimit()",
			expectedType: "sol_int",
			mocks: { getCurrentStakeLimit: 150000000000000000000000n },
			expectedValue: 150000000000000000000000n,
		},
		{
			expr: "steth.getContractVersion()",
			expectedType: "sol_int",
			mocks: { getContractVersion: 2n },
			expectedValue: 2n,
		},

		// structs
		{
			expr: "steth.getStakeLimitFullInfo()",
			expectedType: "SEL_Struct_steth_getStakeLimitFullInfo",
			mocks: { getStakeLimitFullInfo: stakeLimitFullInfoResult },
			typeAt: [
				{
					offset: 27,
					type: "SEL_Struct_steth_getStakeLimitFullInfo",
				},
			],
		},
		{
			expr: "steth.getStakeLimitFullInfo().isStakingPaused",
			expectedType: "bool",
			mocks: { getStakeLimitFullInfo: stakeLimitFullInfoResult },
			expectedValue: false,
		},
		{
			expr: "steth.getStakeLimitFullInfo().currentStakeLimit",
			expectedType: "sol_int",
			mocks: { getStakeLimitFullInfo: stakeLimitFullInfoResult },
			expectedValue: 150000000000000000000000n,
		},
		{
			expr: "steth.getBeaconStat()",
			expectedType: "SEL_Struct_steth_getBeaconStat",
			mocks: { getBeaconStat: beaconStatResult },
		},
		{
			expr: "steth.getBeaconStat().depositedValidators",
			expectedType: "sol_int",
			mocks: { getBeaconStat: beaconStatResult },
			expectedValue: BigInt(500000),
		},

		// comparisons
		{
			expr: "steth.getTotalPooledEther() > solInt(0)",
			expectedType: "bool",
			mocks: { getTotalPooledEther: 9600000000000000000000000n },
			expectedValue: true,
		},
		{
			label: "shares-to-eth conversion > 1 ETH (rebasing gain)",
			expr: "steth.getPooledEthByShares(solInt(1000000000000000000)) > solInt(1000000000000000000)",
			expectedType: "bool",
			mocks: { getPooledEthByShares: 1129411764705882352n },
			expectedValue: true,
		},
		{
			expr: "!steth.isStakingPaused()",
			expectedType: "bool",
			mocks: { isStakingPaused: false },
			expectedValue: true,
		},

		// multi-round: getPooledEthByShares(sharesOf(user)) — real staking pattern
		{
			label: "multi-round: user shares → pooled ETH value",
			expr: "steth.getPooledEthByShares(steth.sharesOf(user))",
			expectedType: "sol_int",
			mocks: {
				sharesOf: 100000000000000000000n,
				getPooledEthByShares: (args: readonly unknown[]) => {
					const shares = args[0] as bigint;
					if (shares === 100000000000000000000n) {
						return 112941176470588235200n;
					}

					return 0n;
				},
			},
			context: { user: USER },
			expectedValue: 112941176470588235200n,
			expectedRounds: 2,
		},

		// struct boolean + numeric combo — real staking health check
		{
			label: "struct combo: staking active AND limit remaining",
			expr: "!steth.getStakeLimitFullInfo().isStakingPaused && steth.getStakeLimitFullInfo().currentStakeLimit > solInt(0)",
			expectedType: "bool",
			mocks: { getStakeLimitFullInfo: stakeLimitFullInfoResult },
			expectedValue: true,
		},

		// cel.bind on multi-round result
		{
			label: "cel.bind: bind user ETH value, compare with 1 ETH",
			expr: "cel.bind(ethVal, steth.getPooledEthByShares(steth.sharesOf(user)), ethVal > solInt(1000000000000000000))",
			expectedType: "bool",
			mocks: {
				sharesOf: 100000000000000000000n,
				getPooledEthByShares: (args: readonly unknown[]) => {
					const shares = args[0] as bigint;
					if (shares === 100000000000000000000n) {
						return 112941176470588235200n;
					}

					return 0n;
				},
			},
			context: { user: USER },
			expectedValue: true,
			expectedRounds: 2,
		},

		// beacon stat: deposited > beacon validators (pending activation)
		{
			label: "beacon stat: deposited validators > beacon validators",
			expr: "steth.getBeaconStat().depositedValidators > steth.getBeaconStat().beaconValidators",
			expectedType: "bool",
			mocks: { getBeaconStat: beaconStatResult },
			expectedValue: true,
		},

		// exchange rate arithmetic
		{
			label: "arithmetic: total pooled ether / total shares (integer division)",
			expr: "steth.getTotalPooledEther() / steth.getTotalShares()",
			expectedType: "sol_int",
			mocks: {
				getTotalPooledEther: 9600000000000000000000000n,
				getTotalShares: 8500000000000000000000000n,
			},
			expectedValue: 1n,
		},

		/*
		 * === Deferred call argument patterns (type-check only) ===
		 * See: https://github.com/abinnovision/sel/issues/45
		 */
		{
			label:
				"deferred: arithmetic on call result as arg — getPooledEthByShares(sharesOf + 1 ETH)",
			expr: "steth.getPooledEthByShares(steth.sharesOf(user) + solInt(1000000000000000000))",
			expectedType: "sol_int",
			mocks: {
				sharesOf: 100000000000000000000n,
				getPooledEthByShares: (args: readonly unknown[]) => {
					const shares = args[0] as bigint;
					if (shares === 100000000000000000000n + 1000000000000000000n) {
						return 114070588235294117600n;
					}

					return 0n;
				},
			},
			context: { user: USER },
			expectedValue: 114070588235294117600n,
			expectedRounds: 1,
		},
		{
			label:
				"deferred: arithmetic on call result as arg — getSharesByPooledEth(getTotalPooledEther / getTotalShares)",
			expr: "steth.getSharesByPooledEth(steth.getTotalPooledEther() / steth.getTotalShares())",
			expectedType: "sol_int",
			mocks: {
				getTotalPooledEther: 9600000000000000000000000n,
				getTotalShares: 8500000000000000000000000n,
				getSharesByPooledEth: (args: readonly unknown[]) => {
					if (args[0] === 1n) {
						return 885416666666666666n;
					}

					return 0n;
				},
			},
			expectedValue: 885416666666666666n,
			expectedRounds: 1,
		},

		// invalid
		{
			label: "invalid: steth.getStakeLimitFullInfo().nonExistent",
			expr: "steth.getStakeLimitFullInfo().nonExistent",
			expectedType: "",
			invalid: true,
			minDiagnostics: 1,
		},
		{
			label: "invalid: steth.nonExistent()",
			expr: "steth.nonExistent()",
			expectedType: "",
			invalid: true,
			minDiagnostics: 1,
		},
	],
});
