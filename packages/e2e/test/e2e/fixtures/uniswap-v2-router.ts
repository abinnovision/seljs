import { uniswapV2Router } from "@seljs-internal/fixtures";

import { defineFixtureGroup } from "../helpers.js";

const abi = uniswapV2Router.abi;

const WETH = "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2";
const FACTORY = "0x5c69bee701ef814a2b6a3edd4b1652cb9cc5aa6f";

export const uniswapV2RouterFixtures = defineFixtureGroup({
	name: "Uniswap V2 Router",
	contracts: {
		router: { abi, address: uniswapV2Router.address },
	},
	cases: [
		{
			expr: "router.factory()",
			expectedType: "sol_address",
			mocks: { factory: FACTORY },
			expectedValue: FACTORY,
			completions: [
				{
					offset: 7,
					includes: [
						"factory",
						"WETH",
						"getAmountOut",
						"getAmountIn",
						"getAmountsOut",
						"getAmountsIn",
						"quote",
					],
				},
			],
		},
		{
			expr: "router.WETH()",
			expectedType: "sol_address",
			mocks: { WETH: WETH },
			expectedValue: WETH,
		},

		// getAmountOut — 3 scalar inputs, single output unwrapped to scalar
		{
			expr: "router.getAmountOut(solInt(1000000000000000000), solInt(100000000000000000000), solInt(200000000000000000000))",
			expectedType: "sol_int",
			mocks: { getAmountOut: 1960000000000000000n },
			expectedValue: 1960000000000000000n,
		},

		// getAmountIn — 3 scalar inputs, single output unwrapped to scalar
		{
			expr: "router.getAmountIn(solInt(1000000000000000000), solInt(100000000000000000000), solInt(200000000000000000000))",
			expectedType: "sol_int",
			mocks: { getAmountIn: 510000000000000000n },
			expectedValue: 510000000000000000n,
		},

		// quote — simple proportion calculation
		{
			expr: "router.quote(solInt(1000000), solInt(100000000), solInt(200000000))",
			expectedType: "sol_int",
			mocks: { quote: 2000000n },
			expectedValue: 2000000n,
		},

		// comparisons
		{
			expr: "router.factory() == router.factory()",
			expectedType: "bool",
			mocks: { factory: FACTORY },
			expectedValue: true,
		},

		// invalid
		{
			label: "invalid: router.getAmountOut() missing args",
			expr: "router.getAmountOut()",
			expectedType: "",
			invalid: true,
			minDiagnostics: 1,
		},
		{
			label: "invalid: router.nonExistent()",
			expr: "router.nonExistent()",
			expectedType: "",
			invalid: true,
			minDiagnostics: 1,
		},
	],
});
