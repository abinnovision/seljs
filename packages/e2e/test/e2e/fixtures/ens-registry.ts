import { ensRegistry } from "@seljs-internal/fixtures";

import { defineFixtureGroup } from "../helpers.js";

const abi = ensRegistry.abi;

const OWNER = "0x0000000000000000000000000000000000000001";
const OPERATOR = "0x0000000000000000000000000000000000000002";

export const ensRegistryFixtures = defineFixtureGroup({
	name: "ENS Registry",
	contracts: {
		ens: { abi, address: ensRegistry.address },
	},
	context: {
		owner: "sol_address",
		operator: "sol_address",
	},
	cases: [
		// isApprovedForAll is the only view function without bytes32 input
		{
			expr: "ens.isApprovedForAll(owner, operator)",
			expectedType: "bool",
			mocks: { isApprovedForAll: true },
			context: { owner: OWNER, operator: OPERATOR },
			expectedValue: true,
			completions: [
				{
					offset: 4,
					includes: [
						"isApprovedForAll",
						"owner",
						"resolver",
						"recordExists",
						"ttl",
					],
				},
			],
		},
		{
			expr: "!ens.isApprovedForAll(owner, operator)",
			expectedType: "bool",
			mocks: { isApprovedForAll: true },
			context: { owner: OWNER, operator: OPERATOR },
			expectedValue: false,
		},

		// bytes32 input functions — now reachable via hexBytes(string, int) literal
		{
			label: "ens.owner(hexBytes(..., 32)) — length-asserted bytes32 literal",
			expr: 'ens.owner(hexBytes("0x0000000000000000000000000000000000000000000000000000000000000001", 32))',
			expectedType: "sol_address",
			mocks: { owner: "0xDeaDbeefdEAdbeefdEadbEEFdeadbeEFdEaDbeeF" },
			expectedValue: "0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef",
		},
		{
			label: "ens.resolver(hexBytes(..., 32))",
			expr: 'ens.resolver(hexBytes("0x0000000000000000000000000000000000000000000000000000000000000001", 32))',
			expectedType: "sol_address",
			mocks: { resolver: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48" },
			expectedValue: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
		},
		{
			label: "ens.owner(precomputed vitalik.eth namehash)",
			expr: 'ens.owner(hexBytes("0xee6c4522aab0003e8d14cd40a6af439055fd2577951148c14b6cea9a53475835", 32))',
			expectedType: "sol_address",
			mocks: { owner: "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045" },
			expectedValue: "0xd8da6bf26964af9d7eed9e03e53415d37aa96045",
		},
		{
			label: "invalid: ens.nonExistent()",
			expr: "ens.nonExistent()",
			expectedType: "",
			invalid: true,
			minDiagnostics: 1,
		},
	],
});
