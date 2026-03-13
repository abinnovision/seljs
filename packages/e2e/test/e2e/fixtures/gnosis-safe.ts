import { gnosisSafe } from "@seljs-internal/fixtures";

import { defineFixtureGroup } from "../helpers.js";

const abi = gnosisSafe.abi;

const OWNER_A = "0x0000000000000000000000000000000000000001";
const OWNER_B = "0x0000000000000000000000000000000000000002";
const MODULE = "0x0000000000000000000000000000000000000003";

export const gnosisSafeFixtures = defineFixtureGroup({
	name: "Gnosis Safe",
	contracts: {
		safe: { abi, address: gnosisSafe.address },
	},
	context: {
		owner: "sol_address",
		module: "sol_address",
	},
	cases: [
		{
			expr: "safe.VERSION()",
			expectedType: "string",
			mocks: { VERSION: "1.3.0" },
			expectedValue: "1.3.0",
			completions: [
				{
					offset: 5,
					includes: [
						"VERSION",
						"getOwners",
						"getThreshold",
						"nonce",
						"isOwner",
						"isModuleEnabled",
						"getChainId",
					],
				},
			],
		},
		{
			expr: "safe.getOwners()",
			expectedType: "list<sol_address>",
			mocks: { getOwners: [OWNER_A, OWNER_B] },
			expectedValue: [OWNER_A, OWNER_B],
		},
		{
			expr: "safe.getThreshold()",
			expectedType: "sol_int",
			mocks: { getThreshold: 2n },
			expectedValue: 2n,
		},
		{
			expr: "safe.nonce()",
			expectedType: "sol_int",
			mocks: { nonce: 42n },
			expectedValue: 42n,
		},
		{
			expr: "safe.getChainId()",
			expectedType: "sol_int",
			mocks: { getChainId: 1n },
			expectedValue: 1n,
		},
		{
			expr: "safe.isOwner(owner)",
			expectedType: "bool",
			mocks: { isOwner: true },
			context: { owner: OWNER_A, module: MODULE },
			expectedValue: true,
		},
		{
			expr: "safe.isModuleEnabled(module)",
			expectedType: "bool",
			mocks: { isModuleEnabled: false },
			context: { owner: OWNER_A, module: MODULE },
			expectedValue: false,
		},

		// comparisons
		{
			expr: "safe.getThreshold() > solInt(1)",
			expectedType: "bool",
			mocks: { getThreshold: 2n },
			expectedValue: true,
		},
		{
			expr: "safe.nonce() > solInt(0)",
			expectedType: "bool",
			mocks: { nonce: 42n },
			expectedValue: true,
		},
		{
			expr: "!safe.isModuleEnabled(module)",
			expectedType: "bool",
			mocks: { isModuleEnabled: false },
			context: { owner: OWNER_A, module: MODULE },
			expectedValue: true,
		},

		// list operations on getOwners() return
		{
			label: "list.size() on address[] return",
			expr: "safe.getOwners().size()",
			expectedType: "int",
			mocks: { getOwners: [OWNER_A, OWNER_B] },
			expectedValue: 2n,
		},
		{
			label: "list index access [0] on address[]",
			expr: "safe.getOwners()[0]",
			expectedType: "sol_address",
			mocks: { getOwners: [OWNER_A, OWNER_B] },
			expectedValue: OWNER_A,
		},
		{
			label: "list index access [1] on address[]",
			expr: "safe.getOwners()[1]",
			expectedType: "sol_address",
			mocks: { getOwners: [OWNER_A, OWNER_B] },
			expectedValue: OWNER_B,
		},

		// list macros
		{
			label: "list.exists() macro on address[]",
			expr: "safe.getOwners().exists(o, o == owner)",
			expectedType: "bool",
			mocks: { getOwners: [OWNER_A, OWNER_B] },
			context: { owner: OWNER_B, module: MODULE },
			expectedValue: true,
		},
		{
			label: "list.exists() macro — not found",
			expr: "safe.getOwners().exists(o, o == module)",
			expectedType: "bool",
			mocks: { getOwners: [OWNER_A, OWNER_B] },
			context: { owner: OWNER_A, module: MODULE },
			expectedValue: false,
		},
		{
			label: "list.all() macro on address[]",
			expr: 'safe.getOwners().all(o, o != solAddress("0x0000000000000000000000000000000000000000"))',
			expectedType: "bool",
			mocks: { getOwners: [OWNER_A, OWNER_B] },
			expectedValue: true,
		},
		{
			label: "list.filter() macro on address[]",
			expr: "safe.getOwners().filter(o, o == owner).size()",
			expectedType: "int",
			mocks: { getOwners: [OWNER_A, OWNER_B] },
			context: { owner: OWNER_A, module: MODULE },
			expectedValue: 1n,
		},

		// combined expressions
		{
			label: "combined: list size in comparison",
			expr: "safe.getOwners().size() >= safe.getThreshold()",
			expectedType: "bool",
			mocks: {
				getOwners: [OWNER_A, OWNER_B],
				getThreshold: 2n,
			},
			expectedValue: true,
		},
		{
			label: "combined: negation with list macro",
			expr: "!safe.getOwners().exists(o, o == module)",
			expectedType: "bool",
			mocks: { getOwners: [OWNER_A, OWNER_B] },
			context: { owner: OWNER_A, module: MODULE },
			expectedValue: true,
		},
		{
			label: "combined: logical AND with multiple contract calls",
			expr: "safe.getThreshold() > solInt(1) && safe.getOwners().size() > 1",
			expectedType: "bool",
			mocks: {
				getThreshold: 2n,
				getOwners: [OWNER_A, OWNER_B],
			},
			expectedValue: true,
		},
		{
			label: "combined: logical OR with ternary",
			expr: 'safe.getThreshold() > solInt(5) || safe.getOwners().size() > 1 ? "multi-sig" : "solo"',
			expectedType: "string",
			mocks: {
				getThreshold: 2n,
				getOwners: [OWNER_A, OWNER_B],
			},
			expectedValue: "multi-sig",
		},

		// complex: cel.bind chains contract result into macro predicate
		{
			label: "cel.bind + filter: threshold gates owner count",
			expr: "cel.bind(t, safe.getThreshold(), safe.getOwners().filter(o, o != module).size() >= t)",
			expectedType: "bool",
			mocks: {
				getThreshold: 2n,
				getOwners: [OWNER_A, OWNER_B],
			},
			context: { owner: OWNER_A, module: MODULE },
			expectedValue: true,
		},
		{
			label: "cel.bind + filter: threshold NOT met after filtering",
			expr: "cel.bind(t, safe.getThreshold(), safe.getOwners().filter(o, o != owner).size() >= t)",
			expectedType: "bool",
			mocks: {
				getThreshold: 2n,
				getOwners: [OWNER_A, OWNER_B],
			},
			context: { owner: OWNER_A, module: MODULE },
			expectedValue: false,
		},
		{
			label: "chained: filter → size → comparison with contract call",
			expr: "safe.getOwners().filter(o, o != module).size() >= safe.getThreshold()",
			expectedType: "bool",
			mocks: {
				getThreshold: 2n,
				getOwners: [OWNER_A, OWNER_B],
			},
			context: { owner: OWNER_A, module: MODULE },
			expectedValue: true,
		},
		{
			label: "ternary: macro condition → contract call branches",
			expr: "safe.getOwners().exists(o, o == owner) ? safe.nonce() : solInt(0)",
			expectedType: "sol_int",
			mocks: {
				getOwners: [OWNER_A, OWNER_B],
				nonce: 42n,
			},
			context: { owner: OWNER_A, module: MODULE },
			expectedValue: 42n,
		},
		{
			label: "ternary: macro false → fallback branch",
			expr: "safe.getOwners().exists(o, o == module) ? safe.nonce() : solInt(0)",
			expectedType: "sol_int",
			mocks: {
				getOwners: [OWNER_A, OWNER_B],
				nonce: 42n,
			},
			context: { owner: OWNER_A, module: MODULE },
			expectedValue: 0n,
		},
		{
			label: "nested: index on filtered list",
			expr: "safe.getOwners().filter(o, o != owner)[0]",
			expectedType: "sol_address",
			mocks: { getOwners: [OWNER_A, OWNER_B] },
			context: { owner: OWNER_A, module: MODULE },
			expectedValue: OWNER_B,
		},

		// sol_int <op> int arithmetic (left operand sol_int — result inferred as sol_int, correct)
		{
			label: "sol_int * int: threshold * owner count",
			expr: "safe.getThreshold() * safe.getOwners().size()",
			expectedType: "sol_int",
			mocks: {
				getThreshold: 2n,
				getOwners: [OWNER_A, OWNER_B],
			},
			expectedValue: 4n,
		},
		{
			label: "sol_int + int: nonce + owner count",
			expr: "safe.nonce() + safe.getOwners().size()",
			expectedType: "sol_int",
			mocks: {
				nonce: 42n,
				getOwners: [OWNER_A, OWNER_B],
			},
			expectedValue: 44n,
		},
		{
			label: "sol_int - int: nonce - owner count",
			expr: "safe.nonce() - safe.getOwners().size()",
			expectedType: "sol_int",
			mocks: {
				nonce: 42n,
				getOwners: [OWNER_A, OWNER_B],
			},
			expectedValue: 40n,
		},

		// int <op> sol_int comparison (both directions are registered — returns bool)
		{
			label: "int < sol_int comparison: literal vs contract return",
			expr: "1 < safe.getThreshold()",
			expectedType: "bool",
			mocks: { getThreshold: 2n },
			expectedValue: true,
		},
		{
			label: "int >= sol_int comparison: list size vs contract return",
			expr: "safe.getOwners().size() >= safe.getThreshold()",
			expectedType: "bool",
			mocks: {
				getOwners: [OWNER_A, OWNER_B],
				getThreshold: 3n,
			},
			expectedValue: false,
		},

		/*
		 * === Deferred call argument patterns (type-check only) ===
		 * See: https://github.com/abinnovision/sel/issues/45
		 */
		{
			label:
				"deferred: map with bool-returning call — owners.map(o, isOwner(o))",
			expr: "safe.getOwners().map(o, safe.isOwner(o))",
			expectedType: "list<bool>",
			mocks: {
				getOwners: [OWNER_A, OWNER_B],
				isOwner: (args: readonly unknown[]) => {
					const addr = (args[0] as string).toLowerCase();

					return (
						addr === OWNER_A.toLowerCase() || addr === OWNER_B.toLowerCase()
					);
				},
			},
			expectedValue: [true, true],
			expectedRounds: 1,
		},
		{
			label:
				"deferred: filter with call in predicate — owners.filter(o, isOwner(o))",
			expr: "safe.getOwners().filter(o, safe.isOwner(o))",
			expectedType: "list<sol_address>",
			mocks: {
				getOwners: [OWNER_A, OWNER_B],
				isOwner: (args: readonly unknown[]) => {
					const addr = (args[0] as string).toLowerCase();

					return (
						addr === OWNER_A.toLowerCase() || addr === OWNER_B.toLowerCase()
					);
				},
			},
			expectedValue: [OWNER_A, OWNER_B],
			expectedRounds: 1,
		},
		{
			label: "deferred: all with call in predicate — all owners are owners",
			expr: "safe.getOwners().all(o, safe.isOwner(o))",
			expectedType: "bool",
			mocks: {
				getOwners: [OWNER_A, OWNER_B],
				isOwner: (args: readonly unknown[]) => {
					const addr = (args[0] as string).toLowerCase();

					return (
						addr === OWNER_A.toLowerCase() || addr === OWNER_B.toLowerCase()
					);
				},
			},
			expectedValue: true,
			expectedRounds: 1,
		},
		{
			label:
				"deferred: exists_one with call — exactly one owner matches module check",
			expr: "safe.getOwners().exists_one(o, safe.isModuleEnabled(o))",
			expectedType: "bool",
			mocks: {
				getOwners: [OWNER_A, OWNER_B],
				isModuleEnabled: (args: readonly unknown[]) => {
					return (args[0] as string).toLowerCase() === OWNER_A.toLowerCase();
				},
			},
			expectedValue: true,
			expectedRounds: 1,
		},

		// invalid
		{
			label: "invalid: safe.isOwner() missing required arg",
			expr: "safe.isOwner()",
			expectedType: "",
			invalid: true,
			minDiagnostics: 1,
		},
		{
			label: "invalid: safe.nonExistent()",
			expr: "safe.nonExistent()",
			expectedType: "",
			invalid: true,
			minDiagnostics: 1,
		},
	],
});
