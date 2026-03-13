import { erc4626 } from "@seljs-internal/fixtures";

import { defineFixtureGroup } from "../helpers.js";

const abi = erc4626.abi;
const ADDRESS = "0x0000000000000000000000000000000000004626";
const ASSET_ADDRESS = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";

const USER = "0x0000000000000000000000000000000000000001";

export const erc4626Fixtures = defineFixtureGroup({
	name: "ERC-4626",
	contracts: {
		vault: { abi, address: ADDRESS },
	},
	context: {
		user: "sol_address",
	},
	cases: [
		{
			expr: "vault.asset()",
			expectedType: "sol_address",
			mocks: { asset: ASSET_ADDRESS },
			expectedValue: ASSET_ADDRESS.toLowerCase(),
			completions: [
				{
					offset: 6,
					includes: [
						"asset",
						"totalAssets",
						"totalSupply",
						"balanceOf",
						"convertToAssets",
						"convertToShares",
						"maxDeposit",
						"maxMint",
						"maxRedeem",
						"maxWithdraw",
						"previewDeposit",
						"previewMint",
						"previewRedeem",
						"previewWithdraw",
					],
				},
			],
		},
		{
			expr: "vault.totalAssets()",
			expectedType: "sol_int",
			mocks: { totalAssets: 1000000000000n },
			expectedValue: 1000000000000n,
		},
		{
			expr: "vault.totalSupply()",
			expectedType: "sol_int",
			mocks: { totalSupply: 900000000000n },
			expectedValue: 900000000000n,
		},
		{
			expr: "vault.balanceOf(user)",
			expectedType: "sol_int",
			mocks: { balanceOf: 100000000000n },
			context: { user: USER },
			expectedValue: 100000000000n,
		},
		{
			expr: "vault.convertToAssets(solInt(1000000))",
			expectedType: "sol_int",
			mocks: { convertToAssets: 1111111n },
			expectedValue: 1111111n,
		},
		{
			expr: "vault.convertToShares(solInt(1000000))",
			expectedType: "sol_int",
			mocks: { convertToShares: 900000n },
			expectedValue: 900000n,
		},
		{
			expr: "vault.maxDeposit(user)",
			expectedType: "sol_int",
			mocks: { maxDeposit: 1000000000000000000000n },
			context: { user: USER },
			expectedValue: 1000000000000000000000n,
		},
		{
			expr: "vault.maxRedeem(user)",
			expectedType: "sol_int",
			mocks: { maxRedeem: 100000000000n },
			context: { user: USER },
			expectedValue: 100000000000n,
		},
		{
			expr: "vault.previewDeposit(solInt(1000000))",
			expectedType: "sol_int",
			mocks: { previewDeposit: 900000n },
			expectedValue: 900000n,
		},
		{
			expr: "vault.previewRedeem(solInt(900000))",
			expectedType: "sol_int",
			mocks: { previewRedeem: 1000000n },
			expectedValue: 1000000n,
		},

		// comparisons
		{
			expr: "vault.totalAssets() > solInt(0)",
			expectedType: "bool",
			mocks: { totalAssets: 1000000000000n },
			expectedValue: true,
		},
		{
			expr: "vault.balanceOf(user) > solInt(0)",
			expectedType: "bool",
			mocks: { balanceOf: 100000000000n },
			context: { user: USER },
			expectedValue: true,
		},
		{
			label: "share-to-asset conversion comparison",
			expr: "vault.convertToAssets(solInt(1000000)) > solInt(1000000)",
			expectedType: "bool",
			mocks: { convertToAssets: 1111111n },
			expectedValue: true,
		},

		// multi-round: nested call — convertToAssets(balanceOf(user))
		{
			label: "multi-round: convert user shares to assets",
			expr: "vault.convertToAssets(vault.balanceOf(user))",
			expectedType: "sol_int",
			mocks: {
				balanceOf: 100000000000n,
				convertToAssets: (args: readonly unknown[]) => {
					const shares = args[0] as bigint;
					if (shares === 100000000000n) {
						return 111111111111n;
					}

					return 0n;
				},
			},
			context: { user: USER },
			expectedValue: 111111111111n,
			expectedRounds: 2,
		},

		// exchange rate arithmetic: totalAssets / totalSupply
		{
			label: "arithmetic: exchange rate (integer division)",
			expr: "vault.totalAssets() / vault.totalSupply()",
			expectedType: "sol_int",
			mocks: {
				totalAssets: 1100000000000n,
				totalSupply: 1000000000000n,
			},
			expectedValue: 1n,
		},

		// cel.bind with nested call result
		{
			label: "cel.bind: bind converted assets, compare with threshold",
			expr: "cel.bind(assets, vault.convertToAssets(vault.balanceOf(user)), assets > solInt(100000000000))",
			expectedType: "bool",
			mocks: {
				balanceOf: 100000000000n,
				convertToAssets: (args: readonly unknown[]) => {
					const shares = args[0] as bigint;
					if (shares === 100000000000n) {
						return 111111111111n;
					}

					return 0n;
				},
			},
			context: { user: USER },
			expectedValue: true,
			expectedRounds: 2,
		},

		// ternary: user position size label
		{
			label: "ternary: position size label from balance",
			expr: 'vault.balanceOf(user) > solInt(1000000000000) ? "whale" : "retail"',
			expectedType: "string",
			mocks: { balanceOf: 100000000000n },
			context: { user: USER },
			expectedValue: "retail",
		},

		/*
		 * === Deferred call argument patterns (type-check only) ===
		 * See: https://github.com/abinnovision/sel/issues/45
		 */
		{
			label:
				"deferred: arithmetic on call result as arg — previewRedeem(balanceOf - 1000)",
			expr: "vault.previewRedeem(vault.balanceOf(user) - solInt(1000))",
			expectedType: "sol_int",
			mocks: {
				balanceOf: 100000000000n,
				previewRedeem: (args: readonly unknown[]) => {
					if (args[0] === 100000000000n - 1000n) {
						return 111111110000n;
					}

					return 0n;
				},
			},
			context: { user: USER },
			expectedValue: 111111110000n,
			expectedRounds: 1,
		},
		{
			label:
				"deferred: arithmetic on call result as arg — convertToAssets(totalSupply / 2)",
			expr: "vault.convertToAssets(vault.totalSupply() / solInt(2))",
			expectedType: "sol_int",
			mocks: {
				totalSupply: 900000000000n,
				convertToAssets: (args: readonly unknown[]) => {
					if (args[0] === 450000000000n) {
						return 500000000000n;
					}

					return 0n;
				},
			},
			expectedValue: 500000000000n,
			expectedRounds: 1,
		},

		// invalid
		{
			label: "invalid: vault.convertToAssets() missing required arg",
			expr: "vault.convertToAssets()",
			expectedType: "",
			invalid: true,
			minDiagnostics: 1,
		},
		{
			label: "invalid: vault.nonExistent()",
			expr: "vault.nonExistent()",
			expectedType: "",
			invalid: true,
			minDiagnostics: 1,
		},
	],
});
