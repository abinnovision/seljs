import { chainlinkAggregatorV3 } from "@seljs-internal/fixtures";

import { defineFixtureGroup } from "../helpers.js";

const abi = chainlinkAggregatorV3.abi;

const OWNER = "0x0000000000000000000000000000000000000001";

const latestRoundDataResult = [
	// roundId (uint80)
	110680464442257310985n,

	// answer (int256) — e.g. ETH/USD with 8 decimals
	234567000000n,

	// startedAt
	1709251200n,

	// updatedAt
	1709251260n,

	// answeredInRound (uint80)
	110680464442257310985n,
];

export const chainlinkAggregatorFixtures = defineFixtureGroup({
	name: "Chainlink Aggregator V3",
	contracts: {
		feed: { abi, address: chainlinkAggregatorV3.address },
	},
	schema: {
		structs: [
			{
				name: "SEL_Struct_feed_latestRoundData",
				fieldCount: 5,
				fields: [
					"roundId",
					"answer",
					"startedAt",
					"updatedAt",
					"answeredInRound",
				],
			},
			{
				name: "SEL_Struct_feed_getRoundData",
				fieldCount: 5,
				fields: [
					"roundId",
					"answer",
					"startedAt",
					"updatedAt",
					"answeredInRound",
				],
			},
		],
	},
	cases: [
		{
			expr: "feed.decimals()",
			expectedType: "sol_int",
			mocks: { decimals: 8 },
			expectedValue: BigInt(8),
			completions: [
				{
					offset: 5,
					includes: [
						"decimals",
						"description",
						"latestAnswer",
						"latestRound",
						"latestRoundData",
						"getRoundData",
						"getAnswer",
						"getTimestamp",
						"version",
						"owner",
					],
				},
			],
		},
		{
			expr: "feed.description()",
			expectedType: "string",
			mocks: { description: "ETH / USD" },
			expectedValue: "ETH / USD",
		},
		{
			expr: "feed.version()",
			expectedType: "sol_int",
			mocks: { version: 4n },
			expectedValue: 4n,
		},
		{
			expr: "feed.latestAnswer()",
			expectedType: "sol_int",
			mocks: { latestAnswer: 234567000000n },
			expectedValue: 234567000000n,
		},
		{
			expr: "feed.latestRound()",
			expectedType: "sol_int",
			mocks: { latestRound: 110680464442257310985n },
			expectedValue: 110680464442257310985n,
		},
		{
			expr: "feed.latestTimestamp()",
			expectedType: "sol_int",
			mocks: { latestTimestamp: 1709251260n },
			expectedValue: 1709251260n,
		},
		{
			expr: "feed.owner()",
			expectedType: "sol_address",
			mocks: { owner: OWNER },
			expectedValue: OWNER,
		},

		// latestRoundData struct
		{
			expr: "feed.latestRoundData()",
			expectedType: "SEL_Struct_feed_latestRoundData",
			mocks: { latestRoundData: latestRoundDataResult },
			typeAt: [
				{
					offset: 21,
					type: "SEL_Struct_feed_latestRoundData",
				},
			],
		},
		{
			expr: "feed.latestRoundData().answer",
			expectedType: "sol_int",
			mocks: { latestRoundData: latestRoundDataResult },
			expectedValue: 234567000000n,
		},
		{
			expr: "feed.latestRoundData().updatedAt",
			expectedType: "sol_int",
			mocks: { latestRoundData: latestRoundDataResult },
			expectedValue: 1709251260n,
		},

		// getRoundData struct
		{
			expr: "feed.getRoundData(solInt(110680464442257310985))",
			expectedType: "SEL_Struct_feed_getRoundData",
			mocks: { getRoundData: latestRoundDataResult },
		},

		// comparisons
		{
			expr: "feed.latestAnswer() > solInt(0)",
			expectedType: "bool",
			mocks: { latestAnswer: 234567000000n },
			expectedValue: true,
		},
		{
			label: "price freshness — updatedAt > startedAt",
			expr: "feed.latestRoundData().updatedAt > feed.latestRoundData().startedAt",
			expectedType: "bool",
			mocks: { latestRoundData: latestRoundDataResult },
			expectedValue: true,
		},

		// real-world price validity pattern: answer > 0 AND roundId == answeredInRound
		{
			label: "price validity: positive answer AND round matches",
			expr: "feed.latestRoundData().answer > solInt(0) && feed.latestRoundData().roundId == feed.latestRoundData().answeredInRound",
			expectedType: "bool",
			mocks: { latestRoundData: latestRoundDataResult },
			expectedValue: true,
		},

		// cel.bind: bind answer, use in ternary
		{
			label: "cel.bind: bind price, label as valid/stale",
			expr: 'cel.bind(price, feed.latestRoundData().answer, price > solInt(0) ? "valid" : "stale")',
			expectedType: "string",
			mocks: { latestRoundData: latestRoundDataResult },
			expectedValue: "valid",
		},

		// struct field arithmetic: time since update
		{
			label: "arithmetic: updatedAt - startedAt (round duration)",
			expr: "feed.latestRoundData().updatedAt - feed.latestRoundData().startedAt",
			expectedType: "sol_int",
			mocks: { latestRoundData: latestRoundDataResult },
			expectedValue: 60n,
		},

		// string method on description
		{
			label: "description contains expected pair",
			expr: 'feed.description().contains("ETH")',
			expectedType: "bool",
			mocks: { description: "ETH / USD" },
			expectedValue: true,
		},
		{
			label: "description contains separator",
			expr: 'feed.description().contains("/")',
			expectedType: "bool",
			mocks: { description: "ETH / USD" },
			expectedValue: true,
		},

		/*
		 * === Deferred call argument patterns (type-check only) ===
		 * See: https://github.com/abinnovision/sel/issues/45
		 */
		{
			label:
				"deferred: struct field as call arg — getRoundData(latestRoundData().roundId)",
			expr: "feed.getRoundData(feed.latestRoundData().roundId).answer",
			expectedType: "sol_int",
			mocks: {
				latestRoundData: latestRoundDataResult,
				getRoundData: (args: readonly unknown[]) => {
					if (args[0] === latestRoundDataResult[0]) {
						return latestRoundDataResult;
					}

					return latestRoundDataResult;
				},
			},
			expectedValue: latestRoundDataResult[1],
			expectedRounds: 1,
		},
		{
			label:
				"deferred: struct field as call arg — getAnswer(latestRoundData().roundId)",
			expr: "feed.getAnswer(feed.latestRoundData().roundId)",
			expectedType: "sol_int",
			mocks: {
				latestRoundData: latestRoundDataResult,
				getAnswer: (args: readonly unknown[]) => {
					if (args[0] === latestRoundDataResult[0]) {
						return latestRoundDataResult[1];
					}

					return 0n;
				},
			},
			expectedValue: latestRoundDataResult[1],
			expectedRounds: 1,
		},
		{
			label:
				"deferred: struct field as call arg — getTimestamp(latestRoundData().roundId)",
			expr: "feed.getTimestamp(feed.latestRoundData().roundId)",
			expectedType: "sol_int",
			mocks: {
				latestRoundData: latestRoundDataResult,
				getTimestamp: (args: readonly unknown[]) => {
					if (args[0] === latestRoundDataResult[0]) {
						return latestRoundDataResult[3];
					}

					return 0n;
				},
			},
			expectedValue: latestRoundDataResult[3],
			expectedRounds: 1,
		},

		// invalid
		{
			label: "invalid: feed.latestRoundData().nonExistent",
			expr: "feed.latestRoundData().nonExistent",
			expectedType: "",
			invalid: true,
			minDiagnostics: 1,
		},
	],
});
