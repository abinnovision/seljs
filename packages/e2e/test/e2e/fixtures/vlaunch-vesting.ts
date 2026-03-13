import { vlVesting } from "@seljs-internal/fixtures";

import { defineFixtureGroup } from "../helpers.js";

const abi = vlVesting.abi;

const BENEFICIARY = "0x1234567890abcdef1234567890abcdef12345678";

// getBeneficiaryInfo (named tuple) mock
const beneficiaryInfoResult = {
	// 500 tokens redeemed
	amountRedeemed: 500000000000000000000n,

	// 1000 tokens total
	amount: 1000000000000000000000n,
	revoked: false,
};

// getVestingSchedule (named tuple) mock
const vestingScheduleResult = {
	// Jan 1, 2024
	vestingStartTime: 1704067200n,

	// Jan 1, 2025
	lockupEndDateTimestamp: 1735689600n,

	// 25%
	percentageReleasedAfterLockup: 250000n,

	// 10%
	percentageReleasedOnTGE: 100000n,
};

// beneficiaries (multi-return) — array matching output order
const beneficiariesMultiReturn = [
	// amountRedeemed
	500000000000000000000n,

	// amount
	1000000000000000000000n,

	// revoked
	false,
];

// vestingSchedule (multi-return) — array matching output order
const vestingScheduleMultiReturn = [
	// vestingStartTime
	1704067200n,

	// lockupEndDateTimestamp
	1735689600n,

	// percentageReleasedAfterLockup
	250000n,

	// percentageReleasedOnTGE
	100000n,
];

// releaseTimeline (multi-return) — array matching output order
const releaseTimelineMultiReturn = [
	// releaseTime (Apr 1, 2024)
	1711929600n,

	// percentageReleased (15%)
	150000n,
];

export const vlVestingFixtures = defineFixtureGroup({
	name: "VL Vesting",
	contracts: {
		vesting: { abi, address: vlVesting.address },
	},
	context: {
		beneficiary: "sol_address",
	},
	schema: {
		structs: [
			{
				name: "SEL_Struct_vesting_getBeneficiaryInfo",
				fieldCount: 3,
				fields: ["amountRedeemed", "amount", "revoked"],
			},
			{
				name: "SEL_Struct_vesting_getVestingSchedule",
				fieldCount: 4,
				fields: [
					"vestingStartTime",
					"lockupEndDateTimestamp",
					"percentageReleasedAfterLockup",
					"percentageReleasedOnTGE",
				],
			},
			{
				name: "SEL_Struct_vesting_beneficiaries",
				fieldCount: 3,
				fields: ["amountRedeemed", "amount", "revoked"],
			},
			{
				name: "SEL_Struct_vesting_vestingSchedule",
				fieldCount: 4,
			},
			{
				name: "SEL_Struct_vesting_releaseTimeline",
				fieldCount: 2,
				fields: ["releaseTime", "percentageReleased"],
			},
		],
	},
	cases: [
		{
			expr: "vesting.UNIT()",
			expectedType: "sol_int",
			mocks: { UNIT: 1000000000000000000n },
			expectedValue: 1000000000000000000n,
			completions: [
				{
					// completions after "vesting." — offset 8
					offset: 8,
					includes: [
						"UNIT",
						"owner",
						"token",
						"getBeneficiaryInfo",
						"getVestingSchedule",
						"getVestingReleaseTimeline",
						"lastClaim",
						"releasableAmount",
						"beneficiaries",
						"vestingSchedule",
						"releaseTimeline",
					],
				},
			],
		},
		{
			expr: "vesting.owner()",
			expectedType: "sol_address",
			mocks: { owner: "0xDeaDbeefdEAdbeefdEadbEEFdeadbeEFdEaDbeeF" },
			expectedValue: "0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef",
		},
		{
			expr: "vesting.totalTokensVesting()",
			expectedType: "sol_int",
			mocks: { totalTokensVesting: 5000000000000000000000n },
			expectedValue: 5000000000000000000000n,
		},
		{
			expr: "vesting.token()",
			expectedType: "sol_address",
			mocks: { token: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48" },
			expectedValue: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
		},

		{
			expr: "vesting.lastClaim(beneficiary)",
			expectedType: "sol_int",
			mocks: { lastClaim: 1709251200n },
			context: { beneficiary: BENEFICIARY },
			expectedValue: 1709251200n,
		},
		{
			expr: "vesting.releasableAmount(beneficiary)",
			expectedType: "sol_int",
			mocks: { releasableAmount: 250000000000000000000n },
			context: { beneficiary: BENEFICIARY },
			expectedValue: 250000000000000000000n,
		},

		{
			// "vesting.getBeneficiaryInfo(beneficiary)" has length 39
			expr: "vesting.getBeneficiaryInfo(beneficiary)",
			expectedType: "SEL_Struct_vesting_getBeneficiaryInfo",
			mocks: { getBeneficiaryInfo: beneficiaryInfoResult },
			context: { beneficiary: BENEFICIARY },
			typeAt: [
				{
					// offset 39 = EOF of "vesting.getBeneficiaryInfo(beneficiary)"
					offset: 39,
					type: "SEL_Struct_vesting_getBeneficiaryInfo",
				},
			],
		},
		{
			expr: "vesting.getBeneficiaryInfo(beneficiary).amount",
			expectedType: "sol_int",
			mocks: { getBeneficiaryInfo: beneficiaryInfoResult },
			context: { beneficiary: BENEFICIARY },
			expectedValue: 1000000000000000000000n,
		},
		{
			expr: "vesting.getBeneficiaryInfo(beneficiary).revoked",
			expectedType: "bool",
			mocks: { getBeneficiaryInfo: beneficiaryInfoResult },
			context: { beneficiary: BENEFICIARY },
			expectedValue: false,
		},
		{
			// "vesting.getVestingSchedule()" has length 28
			expr: "vesting.getVestingSchedule()",
			expectedType: "SEL_Struct_vesting_getVestingSchedule",
			mocks: { getVestingSchedule: vestingScheduleResult },
			typeAt: [
				{
					// offset 28 = EOF of "vesting.getVestingSchedule()"
					offset: 28,
					type: "SEL_Struct_vesting_getVestingSchedule",
				},
			],
		},
		{
			expr: "vesting.getVestingSchedule().vestingStartTime",
			expectedType: "sol_int",
			mocks: { getVestingSchedule: vestingScheduleResult },
			expectedValue: 1704067200n,
		},
		{
			expr: "vesting.getVestingSchedule().percentageReleasedOnTGE",
			expectedType: "sol_int",
			mocks: { getVestingSchedule: vestingScheduleResult },
			expectedValue: 100000n,
		},

		{
			// "vesting.beneficiaries(beneficiary)" has length 34
			expr: "vesting.beneficiaries(beneficiary)",
			expectedType: "SEL_Struct_vesting_beneficiaries",
			mocks: { beneficiaries: beneficiariesMultiReturn },
			context: { beneficiary: BENEFICIARY },
			typeAt: [
				{
					// offset 34 = EOF of "vesting.beneficiaries(beneficiary)"
					offset: 34,
					type: "SEL_Struct_vesting_beneficiaries",
				},
			],
		},
		{
			expr: "vesting.beneficiaries(beneficiary).revoked",
			expectedType: "bool",
			mocks: { beneficiaries: beneficiariesMultiReturn },
			context: { beneficiary: BENEFICIARY },
			expectedValue: false,
		},
		{
			// "vesting.vestingSchedule()" has length 25
			expr: "vesting.vestingSchedule()",
			expectedType: "SEL_Struct_vesting_vestingSchedule",
			mocks: { vestingSchedule: vestingScheduleMultiReturn },
			typeAt: [
				{
					// offset 25 = EOF of "vesting.vestingSchedule()"
					offset: 25,
					type: "SEL_Struct_vesting_vestingSchedule",
				},
			],
		},
		{
			expr: "vesting.vestingSchedule().vestingStartTime",
			expectedType: "sol_int",
			mocks: { vestingSchedule: vestingScheduleMultiReturn },
			expectedValue: 1704067200n,
		},
		{
			// releaseTimeline takes uint256 — use solInt(0) to match the param type
			expr: "vesting.releaseTimeline(solInt(0))",
			expectedType: "SEL_Struct_vesting_releaseTimeline",
			mocks: { releaseTimeline: releaseTimelineMultiReturn },
			typeAt: [
				{
					// offset 34 = EOF of "vesting.releaseTimeline(solInt(0))"
					offset: 34,
					type: "SEL_Struct_vesting_releaseTimeline",
				},
			],
		},

		{
			// array-of-tuple return — evaluate skipped (no mock) until array-of-struct support lands
			expr: "vesting.getVestingReleaseTimeline()",
			expectedType: "list<SEL_Struct_vesting_getVestingReleaseTimeline>",
		},

		// struct field (uint256) vs direct uint256 return — same type
		{
			label: "struct field vs direct return — uint256 > uint256 same type",
			expr: "vesting.getBeneficiaryInfo(beneficiary).amount > vesting.UNIT()",
			expectedType: "bool",
			mocks: {
				getBeneficiaryInfo: beneficiaryInfoResult,
				UNIT: 1000000000000000000n,
			},
			context: { beneficiary: BENEFICIARY },

			// 1000e18 > 1e18 = true
			expectedValue: true,
		},

		// struct field (uint256) vs direct uint256 return — cross-function comparison
		{
			label: "struct field vs direct return — uint256 > uint256 cross-function",
			expr: "vesting.getVestingSchedule().vestingStartTime > vesting.lastClaim(beneficiary)",
			expectedType: "bool",
			mocks: {
				getVestingSchedule: vestingScheduleResult,
				lastClaim: 1709251200n,
			},
			context: { beneficiary: BENEFICIARY },

			// 1704067200 > 1709251200 = false
			expectedValue: false,
		},

		// arithmetic between struct fields — uint256 - uint256 (same type)
		{
			expr: "vesting.getBeneficiaryInfo(beneficiary).amount - vesting.getBeneficiaryInfo(beneficiary).amountRedeemed",
			expectedType: "sol_int",
			mocks: { getBeneficiaryInfo: beneficiaryInfoResult },
			context: { beneficiary: BENEFICIARY },
			expectedValue: 500000000000000000000n,
		},

		// direct uint256 return vs uint256 cast — same type (should work)
		{
			expr: "vesting.releasableAmount(beneficiary) > solInt(0)",
			expectedType: "bool",
			mocks: { releasableAmount: 250000000000000000000n },
			context: { beneficiary: BENEFICIARY },
			expectedValue: true,
		},

		// direct uint256 return vs bare literal — uint256 > int cross-type?
		{
			label: "direct uint256 return vs bare literal — uint256 > int cross-type",
			expr: "vesting.releasableAmount(beneficiary) > 0",
			expectedType: "bool",
			mocks: { releasableAmount: 250000000000000000000n },
			context: { beneficiary: BENEFICIARY },
			expectedValue: true,
		},

		// nested call: owner() result feeds into getBeneficiaryInfo() argument
		{
			label: "nested call — owner() as argument to getBeneficiaryInfo()",
			expr: "vesting.getBeneficiaryInfo(vesting.owner()).amount",
			expectedType: "sol_int",
			mocks: {
				owner: "0xDeaDbeefdEAdbeefdEadbEEFdeadbeEFdEaDbeeF",
				getBeneficiaryInfo: beneficiaryInfoResult,
			},
			expectedValue: 1000000000000000000000n,
			expectedRounds: 2,
		},

		// bool struct field with equality
		{
			expr: "vesting.getBeneficiaryInfo(beneficiary).revoked == false",
			expectedType: "bool",
			mocks: { getBeneficiaryInfo: beneficiaryInfoResult },
			context: { beneficiary: BENEFICIARY },
			expectedValue: true,
		},

		// bool struct field negation
		{
			expr: "!vesting.getBeneficiaryInfo(beneficiary).revoked",
			expectedType: "bool",
			mocks: { getBeneficiaryInfo: beneficiaryInfoResult },
			context: { beneficiary: BENEFICIARY },
			expectedValue: true,
		},

		{
			label: "expectedTypeAt: getBeneficiaryInfo arg expects address",
			expr: "vesting.getBeneficiaryInfo(beneficiary)",
			expectedType: "SEL_Struct_vesting_getBeneficiaryInfo",
			context: { beneficiary: BENEFICIARY },
			expectedTypeAt: [
				{
					/*
					 * offset 27 = position inside the argument
					 * "vesting.getBeneficiaryInfo(" is 27 chars
					 */
					offset: 27,
					expectedType: "sol_address",
					context: "function-argument",
				},
			],
		},
		{
			label: "expectedTypeAt: releasableAmount arg expects address",
			expr: "vesting.releasableAmount(beneficiary)",
			expectedType: "sol_int",
			context: { beneficiary: BENEFICIARY },
			expectedTypeAt: [
				{
					/*
					 * offset 25 = position inside the argument
					 * "vesting.releasableAmount(" is 25 chars
					 */
					offset: 25,
					expectedType: "sol_address",
					context: "function-argument",
				},
			],
		},

		{
			label: 'vesting.beneficiaries(solAddress("...")).amount > solInt(1)',
			expr: 'vesting.beneficiaries(solAddress("0xc3a87764271f3e94ab8f5e5a3a56b1bc60b87a21")).amount > solInt(1)',
			expectedType: "bool",
			mocks: { beneficiaries: beneficiariesMultiReturn },
			expectedValue: true,
		},

		{
			label:
				"invalid: vesting.getBeneficiaryInfo() missing required address arg",
			expr: "vesting.getBeneficiaryInfo()",
			expectedType: "",
			invalid: true,
			minDiagnostics: 1,
		},
		{
			label:
				"invalid: vesting.getBeneficiaryInfo(beneficiary).nonExistentField",
			expr: "vesting.getBeneficiaryInfo(beneficiary).nonExistentField",
			expectedType: "",
			invalid: true,
			minDiagnostics: 1,
		},
		{
			label: "invalid: vesting.lastClaim() missing required address arg",
			expr: "vesting.lastClaim()",
			expectedType: "",
			invalid: true,
			minDiagnostics: 1,
		},
		{
			label: "invalid: vesting.nonExistentFunction()",
			expr: "vesting.nonExistentFunction()",
			expectedType: "",
			invalid: true,
			minDiagnostics: 1,
		},
	],
});
