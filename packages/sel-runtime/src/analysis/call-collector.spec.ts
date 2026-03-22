import { type ASTNode, Environment } from "@marcbachmann/cel-js";
import { describe, expect, it } from "vitest";

import { collectCalls } from "./call-collector.js";

/**
 * Creates a simple contract lookup map for testing.
 * collectCalls only needs ContractLookup (.get(name)), not a full registry.
 */
const createRegistry = (): Map<string, true> => {
	const map = new Map<string, true>();
	map.set("token", true);
	map.set("nft", true);
	map.set("staking", true);
	map.set("pool", true);

	return map;
};

const parseAst = (expression: string): ASTNode =>
	new Environment().parse(expression).ast;

describe("src/analysis/call-collector.ts", () => {
	it("extracts a single contract call", () => {
		const registry = createRegistry();
		const calls = collectCalls(parseAst("token.balanceOf(user)"), registry);

		expect(calls).toHaveLength(1);
		expect(calls[0]?.contract).toBe("token");
		expect(calls[0]?.method).toBe("balanceOf");
		expect(calls[0]?.args).toEqual([
			{ type: "variable", variableName: "user" },
		]);
		expect(calls[0]?.id).toBe("token:balanceOf:user");
	});

	it("extracts multiple independent calls", () => {
		const registry = createRegistry();
		const calls = collectCalls(
			parseAst("token.balanceOf(user) + nft.balanceOf(user)"),
			registry,
		);

		expect(calls).toHaveLength(2);
		expect(calls.map((call) => call.contract)).toEqual(["token", "nft"]);
		expect(calls.map((call) => call.method)).toEqual([
			"balanceOf",
			"balanceOf",
		]);
	});

	it("extracts contract calls nested in map literals", () => {
		const registry = createRegistry();
		const calls = collectCalls(
			parseAst(
				'{"tokenBalance": token.balanceOf(user), "nftBalance": nft.balanceOf(user)}',
			),
			registry,
		);

		expect(calls).toHaveLength(2);
		expect(calls.map((call) => call.contract)).toEqual(["token", "nft"]);
		expect(calls.map((call) => call.method)).toEqual([
			"balanceOf",
			"balanceOf",
		]);
	});

	it("extracts solInt() literal argument for contract calls", () => {
		const registry = createRegistry();
		const calls = collectCalls(parseAst("nft.ownerOf(solInt(1))"), registry);

		expect(calls).toHaveLength(1);
		expect(calls[0]?.contract).toBe("nft");
		expect(calls[0]?.method).toBe("ownerOf");
		expect(calls[0]?.args).toEqual([{ type: "literal", value: 1n }]);
	});

	it("extracts solInt() variable argument for contract calls", () => {
		const registry = createRegistry();
		const calls = collectCalls(
			parseAst("nft.ownerOf(solInt(tokenId))"),
			registry,
		);

		expect(calls).toHaveLength(1);
		expect(calls[0]?.contract).toBe("nft");
		expect(calls[0]?.method).toBe("ownerOf");
		expect(calls[0]?.args).toEqual([
			{ type: "variable", variableName: "tokenId" },
		]);
	});

	it("extracts nested calls with call_result dependency", () => {
		const registry = createRegistry();
		const calls = collectCalls(
			parseAst("nft.ownerOf(staking.stakedTokenId(user))"),
			registry,
		);

		expect(calls).toHaveLength(2);

		const inner = calls.find((call) => call.contract === "staking");
		const outer = calls.find((call) => call.contract === "nft");

		expect(inner).toBeDefined();
		expect(outer).toBeDefined();
		expect(inner?.method).toBe("stakedTokenId");
		expect(inner?.args).toEqual([{ type: "variable", variableName: "user" }]);

		expect(outer?.method).toBe("ownerOf");
		expect(outer?.args).toEqual([
			{ type: "call_result", dependsOnCallId: inner?.id },
		]);
	});

	it("extracts literal argument as literal type", () => {
		const registry = createRegistry();
		const calls = collectCalls(parseAst('token.balanceOf("0x1234")'), registry);

		expect(calls).toHaveLength(1);
		expect(calls[0]?.args).toEqual([{ type: "literal", value: "0x1234" }]);
		expect(calls[0]?.id).toBe("token:balanceOf:0x1234");
	});

	it("extracts solAddress() literal argument for contract calls", () => {
		const registry = createRegistry();
		const calls = collectCalls(
			parseAst(
				'token.balanceOf(solAddress("0xd8da6bf26964af9d7eed9e03e53415d37aa96045"))',
			),
			registry,
		);

		expect(calls).toHaveLength(1);
		expect(calls[0]?.contract).toBe("token");
		expect(calls[0]?.method).toBe("balanceOf");
		expect(calls[0]?.args).toEqual([
			{
				type: "literal",
				value: "0xd8da6bf26964af9d7eed9e03e53415d37aa96045",
			},
		]);
	});

	it("extracts solAddress() variable argument for contract calls", () => {
		const registry = createRegistry();
		const calls = collectCalls(
			parseAst("token.balanceOf(solAddress(userAddr))"),
			registry,
		);

		expect(calls).toHaveLength(1);
		expect(calls[0]?.args).toEqual([
			{ type: "variable", variableName: "userAddr" },
		]);
	});

	it("extracts solInt() literal argument for contract calls (from int)", () => {
		const registry = createRegistry();
		const calls = collectCalls(parseAst("nft.ownerOf(solInt(42))"), registry);

		expect(calls).toHaveLength(1);
		expect(calls[0]?.args).toEqual([{ type: "literal", value: 42n }]);
	});

	it("ignores non-contract calls", () => {
		const registry = createRegistry();
		const calls = collectCalls(
			parseAst("size(list) + token.balanceOf(user)"),
			registry,
		);

		expect(calls).toHaveLength(1);
		expect(calls[0]?.contract).toBe("token");
		expect(calls[0]?.method).toBe("balanceOf");
	});

	it("returns empty array when no contract call exists", () => {
		const registry = createRegistry();
		const calls = collectCalls(parseAst("1 + 2"), registry);

		expect(calls).toEqual([]);
	});

	it("skips cel.bind call while still collecting nested contract call", () => {
		const registry = createRegistry();
		const calls = collectCalls(
			parseAst("cel.bind(x, token.balanceOf(user), x > 0)"),
			registry,
		);

		expect(calls).toHaveLength(1);
		expect(calls[0]?.contract).toBe("token");
		expect(calls[0]?.method).toBe("balanceOf");
		expect(calls[0]?.args).toEqual([
			{ type: "variable", variableName: "user" },
		]);
	});

	it("skips call with arithmetic on call result as arg (deferred)", () => {
		const registry = createRegistry();
		const calls = collectCalls(
			parseAst("nft.ownerOf(staking.stakedTokenId(user) + 1)"),
			registry,
		);

		// Only the inner call is collected; outer call is deferred
		expect(calls).toHaveLength(1);
		expect(calls[0]?.contract).toBe("staking");
		expect(calls[0]?.method).toBe("stakedTokenId");
	});

	it("skips call with member access on call result as arg (deferred)", () => {
		const registry = createRegistry();
		const calls = collectCalls(
			parseAst("nft.ownerOf(nft.balanceOf(user) - 1)"),
			registry,
		);

		// Inner balanceOf collected, outer ownerOf deferred
		expect(calls).toHaveLength(1);
		expect(calls[0]?.contract).toBe("nft");
		expect(calls[0]?.method).toBe("balanceOf");
	});

	it("skips chained calls when inner is deferred", () => {
		const registry = createRegistry();
		const calls = collectCalls(
			parseAst("nft.ownerOf(nft.ownerOf(staking.stakedTokenId(user) + 1))"),
			registry,
		);

		/*
		 * stakedTokenId: collected
		 * inner ownerOf(stakedTokenId + 1): deferred (arithmetic arg)
		 * outer ownerOf(deferred): deferred (arg depends on deferred call)
		 */
		expect(calls).toHaveLength(1);
		expect(calls[0]?.contract).toBe("staking");
		expect(calls[0]?.method).toBe("stakedTokenId");
	});

	it("skips call inside comprehension when arg is iteration variable", () => {
		const registry = createRegistry();
		const calls = collectCalls(
			parseAst("pool.getReservesList().map(r, pool.getReserveData(r))"),
			registry,
		);

		// getReservesList is collected, getReserveData(r) is deferred
		expect(calls).toHaveLength(1);
		expect(calls[0]?.contract).toBe("pool");
		expect(calls[0]?.method).toBe("getReservesList");
	});

	it("skips call when arg is a cel.bind variable", () => {
		const registry = createRegistry();
		const calls = collectCalls(
			parseAst("cel.bind(tid, staking.stakedTokenId(user), nft.ownerOf(tid))"),
			registry,
		);

		// stakedTokenId collected, ownerOf(tid) deferred
		expect(calls).toHaveLength(1);
		expect(calls[0]?.contract).toBe("staking");
		expect(calls[0]?.method).toBe("stakedTokenId");
	});

	it("still collects calls with user context variables (not scoped)", () => {
		const registry = createRegistry();
		const calls = collectCalls(parseAst("token.balanceOf(user)"), registry);

		expect(calls).toHaveLength(1);
		expect(calls[0]?.args).toEqual([
			{ type: "variable", variableName: "user" },
		]);
	});

	describe("address accessor: balance()", () => {
		it("emits synthetic __multicall3.getEthBalance for user.balance()", () => {
			const registry = createRegistry();
			const calls = collectCalls(parseAst("user.balance()"), registry);

			expect(calls).toHaveLength(1);
			expect(calls[0]?.contract).toBe("__multicall3");
			expect(calls[0]?.method).toBe("getEthBalance");
			expect(calls[0]?.args).toEqual([
				{ type: "variable", variableName: "user" },
			]);
			expect(calls[0]?.id).toBe("__multicall3:getEthBalance:user");
		});

		it("collects balance() alongside contract calls", () => {
			const registry = createRegistry();
			const calls = collectCalls(
				parseAst("token.balanceOf(user) + user.balance()"),
				registry,
			);

			expect(calls).toHaveLength(2);
			expect(calls[0]?.contract).toBe("token");
			expect(calls[0]?.method).toBe("balanceOf");
			expect(calls[1]?.contract).toBe("__multicall3");
			expect(calls[1]?.method).toBe("getEthBalance");
		});

		it("creates dependency for chained call: token.owner().balance()", () => {
			const registry = createRegistry();
			const calls = collectCalls(parseAst("token.owner().balance()"), registry);

			expect(calls).toHaveLength(2);

			const ownerCall = calls.find((c) => c.method === "owner");
			const balanceCall = calls.find((c) => c.method === "getEthBalance");

			expect(ownerCall).toBeDefined();
			expect(ownerCall?.contract).toBe("token");

			expect(balanceCall).toBeDefined();
			expect(balanceCall?.contract).toBe("__multicall3");
			expect(balanceCall?.args).toEqual([
				{ type: "call_result", dependsOnCallId: ownerCall?.id },
			]);
		});

		it("deduplicates identical balance() calls", () => {
			const registry = createRegistry();
			const calls = collectCalls(
				parseAst("user.balance() + user.balance()"),
				registry,
			);

			/*
			 * Both resolve to the same call ID, so only one should be collected
			 * (call collector doesn't deduplicate — that's the dependency analyzer's job)
			 * But both calls should have the same id
			 */
			expect(calls.length).toBeGreaterThanOrEqual(1);
			const ids = new Set(calls.map((c) => c.id));
			expect(ids.size).toBe(1);
			expect(ids.has("__multicall3:getEthBalance:user")).toBe(true);
		});

		it("does not treat unknown receiver methods as balance()", () => {
			const registry = createRegistry();
			const calls = collectCalls(parseAst("user.someOtherMethod()"), registry);

			expect(calls).toHaveLength(0);
		});

		it("does not intercept balance with arguments", () => {
			const registry = createRegistry();
			const calls = collectCalls(parseAst("user.balance(extra)"), registry);

			// balance(extra) has args, so it should NOT be treated as address accessor
			expect(calls.every((c) => c.contract !== "__multicall3")).toBe(true);
		});
	});
});
