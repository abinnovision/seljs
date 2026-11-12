import { SELParseError, SELTypeCheckError } from "@seljs/common";
import { pruneSchema } from "@seljs/schema";
import { parseAbiItem } from "viem";
import { describe, expect, it } from "vitest";

import { analyzeFootprint } from "./analyze-footprint.js";
import { SELChecker } from "../checker/index.js";

import type { MethodSchema, SELSchema } from "@seljs/schema";
import type { AbiFunction } from "viem";

const method = (
	signature: string,
	params: MethodSchema["params"],
	returns: string,
): MethodSchema => {
	const abi = parseAbiItem(`function ${signature}`) as AbiFunction;

	return { name: abi.name, params, returns, abi };
};

const SCHEMA: SELSchema = {
	version: "1.0.0",
	contracts: [
		{
			name: "erc20",
			address: "0x6B175474E89094C44Da98b954EedeAC495271d0F",
			methods: [
				method(
					"balanceOf(address account) view returns (uint256)",
					[{ name: "account", type: "sol_address" }],
					"sol_int",
				),
				method("totalSupply() view returns (uint256)", [], "sol_int"),
				method("decimals() view returns (uint8)", [], "sol_int"),
			],
		},
		{
			name: "vault",
			address: "0x1111111111111111111111111111111111111111",
			methods: [
				method("owner() view returns (address)", [], "sol_address"),
				method(
					"get(uint256 id) view returns (uint256)",
					[{ name: "id", type: "sol_int" }],
					"sol_int",
				),
				method(
					"get(address account) view returns (uint256)",
					[{ name: "account", type: "sol_address" }],
					"sol_int",
				),
			],
		},
		{
			name: "nft",
			address: "0x2222222222222222222222222222222222222222",
			methods: [
				method(
					"exists(uint256 tokenId) view returns (bool)",
					[{ name: "tokenId", type: "sol_int" }],
					"bool",
				),
			],
		},
	],
	variables: [
		{ name: "user", type: "sol_address" },
		{ name: "holders", type: "list<sol_address>" },
		{ name: "anything", type: "dyn" },
	],
	types: [],
	macros: [],
	functions: [
		{
			name: "balance",
			signature: "sol_address.balance(): sol_int",
			params: [],
			returns: "sol_int",
			receiverType: "sol_address",
		},
	],
};

const methodsOf = (expression: string): Record<string, string[]> =>
	Object.fromEntries(
		analyzeFootprint(expression, SCHEMA).contracts.map((c) => [
			c.name,
			c.methods.map((m) => m.signature),
		]),
	);

describe("analyzeFootprint", () => {
	it("records a plain call", () => {
		const result = analyzeFootprint("erc20.totalSupply()", SCHEMA);

		expect(result.contracts).toHaveLength(1);
		expect(result.contracts[0]?.name).toBe("erc20");
		expect(result.contracts[0]?.address).toBe(
			"0x6B175474E89094C44Da98b954EedeAC495271d0F",
		);
		expect(result.contracts[0]?.methods).toEqual([
			expect.objectContaining({
				name: "totalSupply",
				selector: "0x18160ddd",
				signature: "totalSupply()",
			}),
		]);
		expect(result.builtins).toEqual([]);
		expect(result.variables).toEqual([]);
	});

	it("records nested calls used as arguments", () => {
		expect(methodsOf("erc20.balanceOf(vault.owner())")).toEqual({
			erc20: ["balanceOf(address)"],
			vault: ["owner()"],
		});
	});

	it("records both ternary branches", () => {
		expect(methodsOf("true ? erc20.totalSupply() : erc20.decimals()")).toEqual({
			erc20: ["decimals()", "totalSupply()"],
		});
	});

	it("records calls inside comprehensions without binder variables", () => {
		for (const expression of [
			"holders.map(h, erc20.balanceOf(h))",
			"holders.filter(h, erc20.balanceOf(h) > 0)",
		]) {
			const result = analyzeFootprint(expression, SCHEMA);

			expect(result.contracts.map((c) => c.name)).toEqual(["erc20"]);
			expect(result.contracts[0]?.methods.map((m) => m.name)).toEqual([
				"balanceOf",
			]);
			expect(result.variables).toEqual(["holders"]);
		}
	});

	it("records nested calls inside comprehensions", () => {
		expect(methodsOf("holders.map(h, erc20.balanceOf(vault.owner()))")).toEqual(
			{ erc20: ["balanceOf(address)"], vault: ["owner()"] },
		);
	});

	it("records a contract method named like a macro", () => {
		expect(methodsOf("nft.exists(1)")).toEqual({ nft: ["exists(uint256)"] });
	});

	it("scopes cel.bind binders to the body", () => {
		const result = analyzeFootprint(
			"cel.bind(user, vault.owner(), erc20.balanceOf(user))",
			SCHEMA,
		);

		expect(
			Object.fromEntries(
				result.contracts.map((c) => [c.name, c.methods.map((m) => m.name)]),
			),
		).toEqual({ erc20: ["balanceOf"], vault: ["owner"] });
		expect(result.variables).toEqual([]);

		expect(analyzeFootprint("cel.bind(x, user, x)", SCHEMA).variables).toEqual([
			"user",
		]);
	});

	it("resolves the exact overload", () => {
		expect(methodsOf("vault.get(1)")).toEqual({ vault: ["get(uint256)"] });
		expect(methodsOf("vault.get(user)")).toEqual({ vault: ["get(address)"] });
	});

	it("records every same-arity overload for dyn arguments", () => {
		const result = analyzeFootprint("vault.get(anything)", SCHEMA);

		expect(result.contracts[0]?.methods.map((m) => m.signature)).toEqual([
			"get(address)",
			"get(uint256)",
		]);
		expect(result.variables).toEqual(["anything"]);
	});

	it("records chain-state builtins", () => {
		const result = analyzeFootprint("user.balance() > 0", SCHEMA);

		expect(result.builtins).toEqual(["sol_address.balance"]);
		expect(result.contracts).toEqual([]);
		expect(result.variables).toEqual(["user"]);
	});

	it("throws the checker's type error for an unknown method", () => {
		const expression = "erc20.nope()";
		const diagnostic = new SELChecker(SCHEMA).check(expression).diagnostics[0];

		expect(() => analyzeFootprint(expression, SCHEMA)).toThrow(
			SELTypeCheckError,
		);
		expect(() => analyzeFootprint(expression, SCHEMA)).toThrow(
			diagnostic?.message,
		);
	});

	it("throws for an unknown contract", () => {
		expect(() => analyzeFootprint("foo.bar()", SCHEMA)).toThrow(
			SELTypeCheckError,
		);
	});

	it("throws a parse error for invalid syntax", () => {
		expect(() => analyzeFootprint("erc20.", SCHEMA)).toThrow(SELParseError);
	});

	it("is sorted, deduplicated, and deterministic", () => {
		const expression =
			"vault.owner() == user && nft.exists(1) && erc20.totalSupply() > 0 && erc20.decimals() > 0 && erc20.totalSupply() > 0 && holders.size() > 0 && user == user";
		const first = analyzeFootprint(expression, SCHEMA);

		expect(first.contracts.map((c) => c.name)).toEqual([
			"erc20",
			"nft",
			"vault",
		]);
		expect(first.contracts[0]?.methods.map((m) => m.signature)).toEqual([
			"decimals()",
			"totalSupply()",
		]);
		expect(first.variables).toEqual(["holders", "user"]);
		expect(analyzeFootprint(expression, SCHEMA)).toEqual(first);
	});

	it("handles dyn receivers", () => {
		expect(() => analyzeFootprint("anything.get(1)", SCHEMA)).toThrow(
			SELTypeCheckError,
		);
		expect(
			analyzeFootprint('anything.startsWith("a")', SCHEMA).contracts,
		).toEqual([]);
	});

	it("records builtin block fields", () => {
		expect(
			analyzeFootprint("block.timestamp > solInt(0)", SCHEMA).builtins,
		).toEqual(["block.timestamp"]);
		expect(
			analyzeFootprint("cel.bind(b, block, b.number)", SCHEMA).builtins,
		).toEqual(["block.number", "block.timestamp"]);
	});

	it("records contracts referenced only by address", () => {
		const footprint = analyzeFootprint("erc20.address", SCHEMA);

		expect(footprint.contracts).toEqual([
			{ name: "erc20", address: SCHEMA.contracts[0]?.address, methods: [] },
		]);
		expect(pruneSchema(SCHEMA, footprint).contracts.map((c) => c.name)).toEqual(
			["erc20"],
		);
	});

	describe("pruneSchema round trip", () => {
		const roundTrip = (expression: string) => {
			const footprint = analyzeFootprint(expression, SCHEMA);
			const pruned = pruneSchema(SCHEMA, footprint);

			expect(new SELChecker(pruned).check(expression).valid).toBe(true);
			expect(analyzeFootprint(expression, pruned)).toEqual(footprint);

			return pruned;
		};

		it("keeps only referenced contracts and methods", () => {
			const pruned = roundTrip(
				"erc20.balanceOf(vault.owner()) > 0 && vault.get(1) > 0 && nft.exists(1) && holders.all(h, erc20.balanceOf(h) > 0)",
			);

			expect(
				Object.fromEntries(
					pruned.contracts.map((c) => [c.name, c.methods.map((m) => m.abi)]),
				),
			).toEqual({
				erc20: [SCHEMA.contracts[0]?.methods[0]?.abi],
				vault: [
					SCHEMA.contracts[1]?.methods[0]?.abi,
					SCHEMA.contracts[1]?.methods[1]?.abi,
				],
				nft: [SCHEMA.contracts[2]?.methods[0]?.abi],
			});
		});

		it("keeps every overload for dyn arguments", () => {
			const pruned = roundTrip("vault.get(anything)");

			expect(pruned.contracts.map((c) => c.name)).toEqual(["vault"]);
			expect(pruned.contracts[0]?.methods.map((m) => m.abi)).toEqual([
				SCHEMA.contracts[1]?.methods[1]?.abi,
				SCHEMA.contracts[1]?.methods[2]?.abi,
			]);
		});
	});
});
