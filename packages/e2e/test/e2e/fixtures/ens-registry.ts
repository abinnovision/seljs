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

		// bytes32 input functions — currently unsupported cast, so invalid-only
		{
			label: "invalid: ens.owner(bytes32(...)) — bytes cast not supported",
			expr: 'ens.owner(bytes32("0x0000000000000000000000000000000000000000000000000000000000000001"))',
			expectedType: "",
			invalid: true,
			minDiagnostics: 1,
		},
		{
			label: "invalid: ens.resolver(bytes32(...)) — bytes cast not supported",
			expr: 'ens.resolver(bytes32("0x0000000000000000000000000000000000000000000000000000000000000001"))',
			expectedType: "",
			invalid: true,
			minDiagnostics: 1,
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
