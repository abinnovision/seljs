import { accessControl } from "@seljs-internal/fixtures";

import { defineFixtureGroup } from "../helpers.js";

const abi = accessControl.abi;

const USER = "0x1234567890abcdef1234567890abcdef12345678";

// keccak256("MINTER_ROLE") — canonical OZ AccessControl role hash
const MINTER_ROLE_HASH =
	"0x9f2df0fed2c77648de5860a4cc508cd0818c85b8b8a1ab4ceeef8d981c8956a6";

// keccak256("DEFAULT_ADMIN_ROLE") is bytes32(0) by convention
const ZERO_BYTES32 =
	"0x0000000000000000000000000000000000000000000000000000000000000000";

export const accessControlFixtures = defineFixtureGroup({
	name: "AccessControl (keccak256 roles)",
	contracts: {
		ac: { abi, address: accessControl.address },
	},
	context: {
		user: "sol_address",
	},
	cases: [
		{
			label: 'hasRole(keccak256("MINTER_ROLE"), user) → bool',
			expr: 'ac.hasRole(keccak256("MINTER_ROLE"), user)',
			expectedType: "bool",
			mocks: { hasRole: true },
			context: { user: USER },
			expectedValue: true,
		},
		{
			label: "hasRole returns false when user lacks role",
			expr: 'ac.hasRole(keccak256("MINTER_ROLE"), user)',
			expectedType: "bool",
			mocks: { hasRole: false },
			context: { user: USER },
			expectedValue: false,
		},
		{
			label: 'getRoleAdmin(keccak256("MINTER_ROLE")) → bytes',
			expr: 'ac.getRoleAdmin(keccak256("MINTER_ROLE"))',
			expectedType: "bytes",
			mocks: { getRoleAdmin: ZERO_BYTES32 },
		},
		{
			label: "supportsInterface(hexBytes(selector, 4)) — bytes4 shape",
			expr: 'ac.supportsInterface(hexBytes("0x7965db0b", 4))',
			expectedType: "bool",
			mocks: { supportsInterface: true },
			expectedValue: true,
		},
		{
			label: "hasRole accepts a precomputed hexBytes role constant",
			expr: `ac.hasRole(hexBytes("${MINTER_ROLE_HASH}", 32), user)`,
			expectedType: "bool",
			mocks: { hasRole: true },
			context: { user: USER },
			expectedValue: true,
		},
	],
});
