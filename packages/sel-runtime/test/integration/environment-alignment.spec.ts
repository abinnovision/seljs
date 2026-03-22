import { createCheckerEnvironment, SELChecker } from "@seljs/checker";
import { buildSchema } from "@seljs/env";
import { Abi } from "ox";
import { describe, expect, it } from "vitest";

import { createSEL } from "../../src/index.js";

import type { SELSchema } from "@seljs/schema";

/**
 * Alignment integration test.
 *
 * Asserts that both the checker environment (hydrated from SELSchema)
 * and the core environment (SELRuntime) produce compatible
 * type-checking results for the same set of contracts and variables.
 */

const ERC20_ABI = Abi.from([
	"function balanceOf(address account) view returns (uint256)",
	"function totalSupply() view returns (uint256)",
]);

const STAKING_ABI = Abi.from([
	"function balanceOf(address account) view returns (uint256)",
	"function rewardRate() view returns (uint256)",
]);

const TOKEN_ADDRESS = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48" as const;
const STAKING_ADDRESS = "0x7D1AfA7B718fb893dB30A3aBc0Cfc608AaCfeBB0" as const;

describe("environment Alignment", () => {
	/**
	 * Build a core SELRuntime and extract its schema,
	 * then build a checker environment from that same schema.
	 */
	const schema: SELSchema = buildSchema({
		contracts: {
			token: { address: TOKEN_ADDRESS, abi: ERC20_ABI },
			staking: { address: STAKING_ADDRESS, abi: STAKING_ABI },
		},
		context: {
			user: "sol_address",
			amount: "sol_int",
		},
	});

	const coreEnv = createSEL({ schema });
	const checkerEnv = createCheckerEnvironment(schema);
	const checker = new SELChecker(schema);

	describe("type-check validity agrees for representative expressions", () => {
		const expressions = [
			"token.totalSupply()",
			"token.balanceOf(user)",
			"staking.rewardRate()",
			"staking.balanceOf(user)",
			"token.totalSupply() + amount",
			"token.balanceOf(user) > amount",
			"user",
			"amount",
		];

		for (const expr of expressions) {
			it(`both agree on validity of: ${expr}`, () => {
				const coreResult = coreEnv.check(expr);
				const checkerResult = checkerEnv.check(expr);

				expect(coreResult.valid).toBe(true);
				expect(checkerResult.valid).toBe(true);
			});
		}
	});

	describe("inferred return types agree", () => {
		// Both core and checker now use unified type names
		const typedExpressions: [string, string][] = [
			["token.totalSupply()", "sol_int"],
			["token.balanceOf(user)", "sol_int"],
			["staking.rewardRate()", "sol_int"],
			["token.totalSupply() + amount", "sol_int"],
			["token.balanceOf(user) > amount", "bool"],
			["user", "sol_address"],
			["amount", "sol_int"],
		];

		for (const [expr, expectedType] of typedExpressions) {
			it(`both agree on type of: ${expr} → ${expectedType}`, () => {
				const coreResult = coreEnv.check(expr);
				const checkerResult = checkerEnv.check(expr);

				expect(coreResult.type).toBe(expectedType);
				expect(checkerResult.type).toBe(expectedType);
			});
		}
	});

	describe("invalid expressions are rejected by both", () => {
		const invalidExpressions = ["token.nonExistent()", "unknown_var"];

		for (const expr of invalidExpressions) {
			it(`both reject: ${expr}`, () => {
				const coreResult = coreEnv.check(expr);
				const checkerResult = checker.check(expr);

				expect(coreResult.valid).toBe(false);
				expect(checkerResult.valid).toBe(false);
			});
		}
	});

	describe("contract type naming is consistent", () => {
		it("checker typeAt returns same contract type name as core schema", () => {
			const typeInfo = checker.typeAt("token", 0);
			expect(typeInfo).toBeDefined();
			expect(typeInfo!.type).toBe("SEL_Contract_token");

			const stakingType = checker.typeAt("staking", 0);
			expect(stakingType).toBeDefined();
			expect(stakingType!.type).toBe("SEL_Contract_staking");
		});

		it("schema contract names match the SEL_Contract_ convention", () => {
			for (const contract of schema.contracts) {
				const typeInfo = checker.typeAt(contract.name, 0);
				expect(typeInfo).toBeDefined();
				expect(typeInfo!.type).toBe(`SEL_Contract_${contract.name}`);
			}
		});
	});
});
