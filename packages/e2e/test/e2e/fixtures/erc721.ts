import { erc721 } from "@seljs-internal/fixtures";

import { defineFixtureGroup } from "../helpers.js";

const abi = erc721.abi;
const ADDRESS = "0x0000000000000000000000000000000000000721";

const OWNER = "0x0000000000000000000000000000000000000001";
const OPERATOR = "0x0000000000000000000000000000000000000002";
const APPROVED = "0x0000000000000000000000000000000000000003";

export const erc721Fixtures = defineFixtureGroup({
	name: "ERC-721",
	contracts: {
		nft: { abi, address: ADDRESS },
	},
	context: {
		owner: "sol_address",
		operator: "sol_address",
	},
	cases: [
		{
			expr: "nft.name()",
			expectedType: "string",
			mocks: { name: "Bored Apes" },
			expectedValue: "Bored Apes",
			completions: [
				{
					offset: 4,
					includes: [
						"name",
						"symbol",
						"totalSupply",
						"balanceOf",
						"ownerOf",
						"getApproved",
						"isApprovedForAll",
						"tokenURI",
					],
				},
			],
		},
		{
			expr: "nft.symbol()",
			expectedType: "string",
			mocks: { symbol: "BAYC" },
			expectedValue: "BAYC",
		},
		{
			expr: "nft.totalSupply()",
			expectedType: "sol_int",
			mocks: { totalSupply: 10000n },
			expectedValue: 10000n,
		},
		{
			expr: "nft.balanceOf(owner)",
			expectedType: "sol_int",
			mocks: { balanceOf: 3n },
			context: { owner: OWNER, operator: OPERATOR },
			expectedValue: 3n,
		},
		{
			expr: "nft.ownerOf(solInt(1))",
			expectedType: "sol_address",
			mocks: { ownerOf: OWNER },
			expectedValue: OWNER,
		},
		{
			expr: "nft.getApproved(solInt(1))",
			expectedType: "sol_address",
			mocks: { getApproved: APPROVED },
			expectedValue: APPROVED,
		},
		{
			expr: "nft.isApprovedForAll(owner, operator)",
			expectedType: "bool",
			mocks: { isApprovedForAll: true },
			context: { owner: OWNER, operator: OPERATOR },
			expectedValue: true,
		},
		{
			expr: "nft.tokenURI(solInt(42))",
			expectedType: "string",
			mocks: { tokenURI: "ipfs://QmTest/42" },
			expectedValue: "ipfs://QmTest/42",
		},

		// comparisons
		{
			expr: "nft.balanceOf(owner) > solInt(0)",
			expectedType: "bool",
			mocks: { balanceOf: 3n },
			context: { owner: OWNER, operator: OPERATOR },
			expectedValue: true,
		},
		{
			expr: "nft.ownerOf(solInt(1)) == owner",
			expectedType: "bool",
			mocks: { ownerOf: OWNER },
			context: { owner: OWNER, operator: OPERATOR },
			expectedValue: true,
		},

		// string methods on tokenURI return
		{
			label: "tokenURI startsWith ipfs://",
			expr: 'nft.tokenURI(solInt(42)).startsWith("ipfs://")',
			expectedType: "bool",
			mocks: { tokenURI: "ipfs://QmTest/42" },
			expectedValue: true,
		},
		{
			label: "tokenURI contains token ID",
			expr: 'nft.tokenURI(solInt(42)).contains("42")',
			expectedType: "bool",
			mocks: { tokenURI: "ipfs://QmTest/42" },
			expectedValue: true,
		},
		{
			label: "tokenURI size",
			expr: "nft.tokenURI(solInt(42)).size()",
			expectedType: "int",
			mocks: { tokenURI: "ipfs://QmTest/42" },
			expectedValue: 16n,
		},

		// combined: ownership + balance check
		{
			label: "combined: owner matches AND has balance",
			expr: "nft.ownerOf(solInt(1)) == owner && nft.balanceOf(owner) > solInt(0)",
			expectedType: "bool",
			mocks: { ownerOf: OWNER, balanceOf: 3n },
			context: { owner: OWNER, operator: OPERATOR },
			expectedValue: true,
		},

		// ternary with ownership check
		{
			label: "ternary: ownership label",
			expr: 'nft.ownerOf(solInt(1)) == owner ? "owned" : "not owned"',
			expectedType: "string",
			mocks: { ownerOf: OWNER },
			context: { owner: OWNER, operator: OPERATOR },
			expectedValue: "owned",
		},

		// name string method
		{
			label: "name matches pattern",
			expr: 'nft.name().matches("^Bored.*")',
			expectedType: "bool",
			mocks: { name: "Bored Apes" },
			expectedValue: true,
		},

		// invalid
		{
			label: "invalid: nft.ownerOf() missing required arg",
			expr: "nft.ownerOf()",
			expectedType: "",
			invalid: true,
			minDiagnostics: 1,
		},
		{
			label: "invalid: nft.nonExistent()",
			expr: "nft.nonExistent()",
			expectedType: "",
			invalid: true,
			minDiagnostics: 1,
		},
	],
});
