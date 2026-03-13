import { curve3pool } from "@seljs-internal/fixtures";

import { defineFixtureGroup } from "../helpers.js";

const abi = curve3pool.abi;

const OWNER = "0x0000000000000000000000000000000000000001";
const DAI = "0x6b175474e89094c44da98b954eedeac495271d0f";
const USDC = "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48";
const USDT = "0xdac17f958d2ee523a2206206994597c13d831ec7";

export const curve3poolFixtures = defineFixtureGroup({
	name: "Curve 3pool",
	contracts: {
		pool: { abi, address: curve3pool.address },
	},
	cases: [
		{
			expr: "pool.A()",
			expectedType: "sol_int",
			mocks: { A: 2000n },
			expectedValue: 2000n,
			completions: [
				{
					offset: 5,
					includes: [
						"A",
						"get_virtual_price",
						"get_dy",
						"coins",
						"balances",
						"fee",
						"owner",
					],
				},
			],
		},
		{
			expr: "pool.get_virtual_price()",
			expectedType: "sol_int",
			mocks: { get_virtual_price: 1020000000000000000n },
			expectedValue: 1020000000000000000n,
		},
		{
			expr: "pool.fee()",
			expectedType: "sol_int",
			mocks: { fee: 4000000n },
			expectedValue: 4000000n,
		},
		{
			expr: "pool.admin_fee()",
			expectedType: "sol_int",
			mocks: { admin_fee: 5000000000n },
			expectedValue: 5000000000n,
		},
		{
			expr: "pool.owner()",
			expectedType: "sol_address",
			mocks: { owner: OWNER },
			expectedValue: OWNER,
		},
		{
			expr: "pool.coins(solInt(0))",
			expectedType: "sol_address",
			mocks: { coins: DAI },
			expectedValue: DAI,
		},
		{
			expr: "pool.balances(solInt(0))",
			expectedType: "sol_int",
			mocks: { balances: 150000000000000000000000000n },
			expectedValue: 150000000000000000000000000n,
		},
		{
			// get_dy uses int128 inputs — tests exotic signed integer params
			expr: "pool.get_dy(solInt(0), solInt(1), solInt(1000000000000000000))",
			expectedType: "sol_int",
			mocks: { get_dy: 999500n },
			expectedValue: 999500n,
		},
		{
			expr: "pool.admin_balances(solInt(0))",
			expectedType: "sol_int",
			mocks: { admin_balances: 500000000000000000n },
			expectedValue: 500000000000000000n,
		},

		// comparisons
		{
			expr: "pool.get_virtual_price() > solInt(1000000000000000000)",
			expectedType: "bool",
			mocks: { get_virtual_price: 1020000000000000000n },
			expectedValue: true,
		},
		{
			label: "balance comparison across indices",
			expr: "pool.balances(solInt(0)) > solInt(0)",
			expectedType: "bool",
			mocks: { balances: 150000000000000000000000000n },
			expectedValue: true,
		},

		// invalid
		{
			label: "invalid: pool.get_dy() missing args",
			expr: "pool.get_dy()",
			expectedType: "",
			invalid: true,
			minDiagnostics: 1,
		},
		{
			label: "invalid: pool.nonExistent()",
			expr: "pool.nonExistent()",
			expectedType: "",
			invalid: true,
			minDiagnostics: 1,
		},
	],
});
