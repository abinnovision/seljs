import { balancerV2Vault } from "@seljs-internal/fixtures";

import { defineFixtureGroup } from "../helpers.js";

const abi = balancerV2Vault.abi;

// bytes32 maps to "bytes" in CEL.
const context = {
	poolId: "bytes",
} as const;

const poolTokensResult = [
	[
		"0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
		"0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",

		// tokens (address[])
	],

	// balances (uint256[])
	[50000000000n, 25000000000000000000000n],

	// lastChangeBlock (uint256)
	18000000n,
];

const POOL_ID =
	"0x5c6ee304399dbdb9c8ef030ab642b10820db8f56000200000000000000000014";

export const balancerVaultFixtures = defineFixtureGroup({
	name: "Balancer V2 Vault",
	contracts: {
		vault: { abi, address: balancerV2Vault.address },
	},
	context,
	schema: {
		structs: [
			{
				name: "SEL_Struct_vault_getPoolTokens",
				fieldCount: 3,
				fields: ["tokens", "balances", "lastChangeBlock"],
			},
		],
	},
	cases: [
		{
			// expr is the bare call — offset 27 (EOF) returns struct type via typeAt
			expr: "vault.getPoolTokens(poolId)",
			expectedType: "SEL_Struct_vault_getPoolTokens",
			mocks: { getPoolTokens: poolTokensResult },
			context: { poolId: POOL_ID },
			completions: [
				{
					// completions after "vault." — offset 6 is 'g' (start of getPoolTokens)
					offset: 6,
					includes: ["getPoolTokens"],
				},
			],
			typeAt: [
				{
					// offset 27 = EOF of "vault.getPoolTokens(poolId)" -> struct type
					offset: 27,
					type: "SEL_Struct_vault_getPoolTokens",
				},
			],
		},
		{
			expr: "vault.getPoolTokens(poolId).lastChangeBlock",

			// uint256 maps to CEL "uint256"
			expectedType: "sol_int",
			mocks: { getPoolTokens: poolTokensResult },
			context: { poolId: POOL_ID },
			expectedValue: 18000000n,
		},
		{
			expr: "vault.getPoolTokens(poolId).tokens",

			// address[] in struct field maps to "list<sol_address>"
			expectedType: "list<sol_address>",
			mocks: { getPoolTokens: poolTokensResult },
			context: { poolId: POOL_ID },
			expectedValue: [
				"0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
				"0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2",
			],
		},

		// struct field (uint256) vs uint256 cast — same type
		{
			label: "struct field vs uint256 cast — uint256 > uint256 same type",
			expr: "vault.getPoolTokens(poolId).lastChangeBlock > solInt(0)",
			expectedType: "bool",
			mocks: { getPoolTokens: poolTokensResult },
			context: { poolId: POOL_ID },
			expectedValue: true,
		},

		// struct field vs bare literal — uint256 > int (cross-type)
		{
			expr: "vault.getPoolTokens(poolId).lastChangeBlock > 0",
			expectedType: "bool",
			mocks: { getPoolTokens: poolTokensResult },
			context: { poolId: POOL_ID },
			expectedValue: true,
		},

		{
			label: "invalid: vault.getPoolTokens(poolId).nonExistentField",
			expr: "vault.getPoolTokens(poolId).nonExistentField",
			expectedType: "",
			invalid: true,
			minDiagnostics: 1,
		},
	],
});
