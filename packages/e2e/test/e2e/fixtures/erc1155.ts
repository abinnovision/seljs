import { erc1155 } from "@seljs-internal/fixtures";

import { defineFixtureGroup } from "../helpers.js";

const abi = erc1155.abi;
const ADDRESS = "0x0000000000000000000000000000000000001155";

const OWNER = "0x0000000000000000000000000000000000000001";
const OPERATOR = "0x0000000000000000000000000000000000000002";

export const erc1155Fixtures = defineFixtureGroup({
	name: "ERC-1155",
	contracts: {
		multi: { abi, address: ADDRESS },
	},
	context: {
		owner: "sol_address",
		operator: "sol_address",
	},
	cases: [
		{
			expr: "multi.balanceOf(owner, solInt(1))",
			expectedType: "sol_int",
			mocks: { balanceOf: 50n },
			context: { owner: OWNER, operator: OPERATOR },
			expectedValue: 50n,
			completions: [
				{
					offset: 6,
					includes: ["balanceOf", "balanceOfBatch", "isApprovedForAll", "uri"],
				},
			],
		},
		{
			expr: "multi.uri(solInt(1))",
			expectedType: "string",
			mocks: { uri: "https://example.com/token/1" },
			expectedValue: "https://example.com/token/1",
		},
		{
			expr: "multi.isApprovedForAll(owner, operator)",
			expectedType: "bool",
			mocks: { isApprovedForAll: false },
			context: { owner: OWNER, operator: OPERATOR },
			expectedValue: false,
		},

		// comparisons
		{
			expr: "multi.balanceOf(owner, solInt(1)) > solInt(0)",
			expectedType: "bool",
			mocks: { balanceOf: 50n },
			context: { owner: OWNER, operator: OPERATOR },
			expectedValue: true,
		},
		{
			expr: "!multi.isApprovedForAll(owner, operator)",
			expectedType: "bool",
			mocks: { isApprovedForAll: false },
			context: { owner: OWNER, operator: OPERATOR },
			expectedValue: true,
		},

		// invalid
		{
			label: "invalid: multi.balanceOf(owner) missing second arg",
			expr: "multi.balanceOf(owner)",
			expectedType: "",
			invalid: true,
			minDiagnostics: 1,
		},
		{
			label: "invalid: multi.nonExistent()",
			expr: "multi.nonExistent()",
			expectedType: "",
			invalid: true,
			minDiagnostics: 1,
		},
	],
});
