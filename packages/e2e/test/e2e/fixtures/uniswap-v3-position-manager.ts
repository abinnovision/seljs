import { uniswapV3PositionManager } from "@seljs-internal/fixtures";

import { defineFixtureGroup } from "../helpers.js";

const abi = uniswapV3PositionManager.abi;

const OWNER = "0x0000000000000000000000000000000000000001";
const OPERATOR = "0x0000000000000000000000000000000000000002";
const TOKEN_0 = "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48";
const TOKEN_1 = "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2";
const FACTORY = "0x1f98431c8ad98523631ae4a59f267346ea31f984";
const WETH9 = "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2";

// positions() returns a 12-field struct
const positionsResult = [
	// nonce (uint96)
	0n,

	// operator (address)
	OPERATOR,

	// token0 (address)
	TOKEN_0,

	// token1 (address)
	TOKEN_1,

	// fee (uint24)
	3000,

	// tickLower (int24)
	-887220,

	// tickUpper (int24)
	887220,

	// liquidity (uint128)
	5000000000000000000n,

	// feeGrowthInside0LastX128 (uint256)
	100000000000000000000n,

	// feeGrowthInside1LastX128 (uint256)
	200000000000000000000n,

	// tokensOwed0 (uint128)
	50000n,

	// tokensOwed1 (uint128)
	30000n,
];

export const uniswapV3PositionManagerFixtures = defineFixtureGroup({
	name: "Uniswap V3 Position Manager",
	contracts: {
		nfpm: { abi, address: uniswapV3PositionManager.address },
	},
	context: {
		owner: "sol_address",
		operator: "sol_address",
	},
	schema: {
		structs: [
			{
				name: "SEL_Struct_nfpm_positions",
				fieldCount: 12,
				fields: [
					"nonce",
					"operator",
					"token0",
					"token1",
					"fee",
					"tickLower",
					"tickUpper",
					"liquidity",
					"feeGrowthInside0LastX128",
					"feeGrowthInside1LastX128",
					"tokensOwed0",
					"tokensOwed1",
				],
			},
		],
	},
	cases: [
		{
			expr: "nfpm.name()",
			expectedType: "string",
			mocks: { name: "Uniswap V3 Positions NFT-V1" },
			expectedValue: "Uniswap V3 Positions NFT-V1",
			completions: [
				{
					offset: 5,
					includes: [
						"name",
						"symbol",
						"totalSupply",
						"balanceOf",
						"ownerOf",
						"positions",
						"factory",
						"WETH9",
						"tokenOfOwnerByIndex",
					],
				},
			],
		},
		{
			expr: "nfpm.symbol()",
			expectedType: "string",
			mocks: { symbol: "UNI-V3-POS" },
			expectedValue: "UNI-V3-POS",
		},
		{
			expr: "nfpm.totalSupply()",
			expectedType: "sol_int",
			mocks: { totalSupply: 750000n },
			expectedValue: 750000n,
		},
		{
			expr: "nfpm.factory()",
			expectedType: "sol_address",
			mocks: { factory: FACTORY },
			expectedValue: FACTORY,
		},
		{
			expr: "nfpm.WETH9()",
			expectedType: "sol_address",
			mocks: { WETH9: WETH9 },
			expectedValue: WETH9,
		},
		{
			expr: "nfpm.balanceOf(owner)",
			expectedType: "sol_int",
			mocks: { balanceOf: 5n },
			context: { owner: OWNER, operator: OPERATOR },
			expectedValue: 5n,
		},
		{
			expr: "nfpm.ownerOf(solInt(12345))",
			expectedType: "sol_address",
			mocks: { ownerOf: OWNER },
			expectedValue: OWNER,
		},
		{
			expr: "nfpm.tokenOfOwnerByIndex(owner, solInt(0))",
			expectedType: "sol_int",
			mocks: { tokenOfOwnerByIndex: 12345n },
			context: { owner: OWNER, operator: OPERATOR },
			expectedValue: 12345n,
		},
		{
			expr: "nfpm.isApprovedForAll(owner, operator)",
			expectedType: "bool",
			mocks: { isApprovedForAll: true },
			context: { owner: OWNER, operator: OPERATOR },
			expectedValue: true,
		},

		// positions — large 12-field struct
		{
			expr: "nfpm.positions(solInt(12345))",
			expectedType: "SEL_Struct_nfpm_positions",
			mocks: { positions: positionsResult },
			typeAt: [
				{
					offset: 25,
					type: "SEL_Struct_nfpm_positions",
				},
			],
		},
		{
			expr: "nfpm.positions(solInt(12345)).token0",
			expectedType: "sol_address",
			mocks: { positions: positionsResult },
			expectedValue: TOKEN_0,
		},
		{
			expr: "nfpm.positions(solInt(12345)).token1",
			expectedType: "sol_address",
			mocks: { positions: positionsResult },
			expectedValue: TOKEN_1,
		},
		{
			expr: "nfpm.positions(solInt(12345)).fee",
			expectedType: "sol_int",
			mocks: { positions: positionsResult },
			expectedValue: BigInt(3000),
		},
		{
			expr: "nfpm.positions(solInt(12345)).liquidity",
			expectedType: "sol_int",
			mocks: { positions: positionsResult },
			expectedValue: 5000000000000000000n,
		},
		{
			expr: "nfpm.positions(solInt(12345)).tokensOwed0",
			expectedType: "sol_int",
			mocks: { positions: positionsResult },
			expectedValue: 50000n,
		},
		{
			expr: "nfpm.positions(solInt(12345)).tickLower",
			expectedType: "sol_int",
			mocks: { positions: positionsResult },
			expectedValue: BigInt(-887220),
		},

		// comparisons
		{
			expr: "nfpm.positions(solInt(12345)).liquidity > solInt(0)",
			expectedType: "bool",
			mocks: { positions: positionsResult },
			expectedValue: true,
		},
		{
			expr: "nfpm.positions(solInt(12345)).tokensOwed0 > nfpm.positions(solInt(12345)).tokensOwed1",
			expectedType: "bool",
			mocks: { positions: positionsResult },
			expectedValue: true,
		},

		// multi-round: tokenOfOwnerByIndex → positions — real LP lookup
		{
			label: "multi-round: lookup first position via tokenOfOwnerByIndex",
			expr: "nfpm.positions(nfpm.tokenOfOwnerByIndex(owner, solInt(0))).liquidity",
			expectedType: "sol_int",
			mocks: {
				tokenOfOwnerByIndex: 12345n,
				positions: (args: readonly unknown[]) => {
					const tokenId = args[0] as bigint;
					if (tokenId === 12345n) {
						return positionsResult;
					}

					return positionsResult;
				},
			},
			context: { owner: OWNER, operator: OPERATOR },
			expectedValue: 5000000000000000000n,
			expectedRounds: 2,
		},

		// struct arithmetic: total tokens owed
		{
			label: "arithmetic: tokensOwed0 + tokensOwed1 total",
			expr: "nfpm.positions(solInt(12345)).tokensOwed0 + nfpm.positions(solInt(12345)).tokensOwed1",
			expectedType: "sol_int",
			mocks: { positions: positionsResult },
			expectedValue: 80000n,
		},

		// ternary: position active check
		{
			label: "ternary: active position label from liquidity",
			expr: 'nfpm.positions(solInt(12345)).liquidity > solInt(0) ? "active" : "closed"',
			expectedType: "string",
			mocks: { positions: positionsResult },
			expectedValue: "active",
		},

		// cel.bind: bind position struct field, use in compound check
		{
			label: "cel.bind: bind liquidity, check active + has fees",
			expr: "cel.bind(liq, nfpm.positions(solInt(12345)).liquidity, liq > solInt(0) && nfpm.positions(solInt(12345)).tokensOwed0 > solInt(0))",
			expectedType: "bool",
			mocks: { positions: positionsResult },
			expectedValue: true,
		},

		// struct field address comparison with context
		{
			label: "position token0 matches expected asset",
			expr: "nfpm.positions(solInt(12345)).token0 == owner",
			expectedType: "bool",
			mocks: { positions: positionsResult },
			context: { owner: TOKEN_0, operator: OPERATOR },
			expectedValue: true,
		},

		// combined: has balance AND first position is active (multi-round)
		{
			label:
				"multi-round ternary: has positions ? first position liquidity : 0",
			expr: "nfpm.balanceOf(owner) > solInt(0) ? nfpm.positions(nfpm.tokenOfOwnerByIndex(owner, solInt(0))).liquidity : solInt(0)",
			expectedType: "sol_int",
			mocks: {
				balanceOf: 5n,
				tokenOfOwnerByIndex: 12345n,
				positions: (args: readonly unknown[]) => {
					const tokenId = args[0] as bigint;
					if (tokenId === 12345n) {
						return positionsResult;
					}

					return positionsResult;
				},
			},
			context: { owner: OWNER, operator: OPERATOR },
			expectedValue: 5000000000000000000n,
			expectedRounds: 2,
		},

		/*
		 * === Deferred call argument patterns (type-check only) ===
		 * See: https://github.com/abinnovision/sel/issues/45
		 */
		{
			label:
				"deferred: arithmetic on call result in nested arg — positions(tokenOfOwnerByIndex(owner, balanceOf - 1))",
			expr: "nfpm.positions(nfpm.tokenOfOwnerByIndex(owner, nfpm.balanceOf(owner) - solInt(1))).liquidity",
			expectedType: "sol_int",
			mocks: {
				balanceOf: 5n,
				tokenOfOwnerByIndex: (args: readonly unknown[]) => {
					if (args[1] === 4n) {
						return 99999n;
					}

					return 12345n;
				},
				positions: (args: readonly unknown[]) => {
					if (args[0] === 99999n) {
						return positionsResult;
					}

					return positionsResult;
				},
			},
			context: { owner: OWNER, operator: OPERATOR },
			expectedValue: 5000000000000000000n,
			expectedRounds: 1,
		},
		{
			label:
				"deferred: struct field as call arg — ownerOf(positions().nonce) (contrived but tests the pattern)",
			expr: "nfpm.ownerOf(nfpm.positions(solInt(12345)).nonce)",
			expectedType: "sol_address",
			mocks: {
				positions: positionsResult,
				ownerOf: (args: readonly unknown[]) => {
					if (args[0] === 0n) {
						return OWNER;
					}

					return OWNER;
				},
			},
			expectedValue: OWNER,
			expectedRounds: 1,
		},

		// invalid
		{
			label: "invalid: nfpm.positions() missing required arg",
			expr: "nfpm.positions()",
			expectedType: "",
			invalid: true,
			minDiagnostics: 1,
		},
		{
			label: "invalid: nfpm.positions(solInt(1)).nonExistent",
			expr: "nfpm.positions(solInt(1)).nonExistent",
			expectedType: "",
			invalid: true,
			minDiagnostics: 1,
		},
	],
});
