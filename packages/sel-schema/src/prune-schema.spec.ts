import { describe, expect, it } from "vitest";

import { pruneSchema } from "./prune-schema.js";

import type { FootprintResult } from "./footprint.js";
import type { SELSchema } from "./types.js";
import type { AbiFunction } from "abitype";

const fn = (name: string, ...types: string[]): AbiFunction => ({
	type: "function",
	name,
	inputs: types.map((type) => ({ name: "", type })),
	outputs: [],
	stateMutability: "view",
});

const method = (abi: AbiFunction, returns = "int") => ({
	name: abi.name,
	params: [],
	abi,
	returns,
});

const balanceOf = fn("balanceOf", "address");
const totalSupply = fn("totalSupply");
const getUint = fn("get", "uint256");
const getAddress = fn("get", "address");

const schema: SELSchema = {
	version: "1",
	contracts: [
		{
			name: "erc20",
			address: "0x0000000000000000000000000000000000000001",
			methods: [method(balanceOf), method(totalSupply)],
		},
		{
			name: "vault",
			address: "0x0000000000000000000000000000000000000002",
			methods: [method(getUint, "Outer"), method(getAddress, "Dropped")],
		},
		{
			name: "other",
			address: "0x0000000000000000000000000000000000000003",
			methods: [method(totalSupply)],
		},
	],
	variables: [{ name: "items", type: "list<Listed>" }],
	types: [
		{ name: "sol_address", kind: "primitive" },
		{ name: "Outer", kind: "struct", fields: [{ name: "i", type: "Inner" }] },
		{ name: "Inner", kind: "struct", fields: [] },
		{ name: "Dropped", kind: "struct", fields: [] },
		{ name: "Listed", kind: "struct", fields: [] },
		{ name: "FromFunction", kind: "struct", fields: [] },
	],
	functions: [
		{
			name: "make",
			signature: "make(): FromFunction",
			params: [],
			returns: "FromFunction",
		},
	],
	macros: [],
};

const footprintOf = (name: string, abis: AbiFunction[]): FootprintResult => ({
	contracts: [
		{
			name,
			address: "0x0000000000000000000000000000000000000001",
			methods: abis.map((abi) => ({
				name: abi.name,
				selector: "0x00000000",
				signature: `${abi.name}(${abi.inputs.map((i) => i.type).join(",")})`,
				abi,
			})),
		},
	],
	builtins: [],
	variables: [],
});

describe("src/prune-schema.ts", () => {
	describe("pruneSchema", () => {
		it("drops unreferenced contracts", () => {
			const pruned = pruneSchema(schema, footprintOf("erc20", [balanceOf]));

			expect(pruned.contracts.map((c) => c.name)).toEqual(["erc20"]);
		});

		it("drops unreferenced methods and overloads", () => {
			const erc20 = pruneSchema(schema, footprintOf("erc20", [balanceOf]));
			const vault = pruneSchema(schema, footprintOf("vault", [getUint]));

			expect(erc20.contracts[0]?.methods.map((m) => m.name)).toEqual([
				"balanceOf",
			]);
			expect(vault.contracts[0]?.methods).toHaveLength(1);
			expect(vault.contracts[0]?.methods[0]?.abi).toEqual(getUint);
		});

		it("matches methods regardless of parameter names", () => {
			const renamed: AbiFunction = {
				...balanceOf,
				inputs: [{ name: "account", type: "address" }],
			};
			const pruned = pruneSchema(schema, footprintOf("erc20", [renamed]));

			expect(pruned.contracts[0]?.methods.map((m) => m.name)).toEqual([
				"balanceOf",
			]);
		});

		it("keeps reachable structs and drops those used only by dropped methods", () => {
			const names = pruneSchema(
				schema,
				footprintOf("vault", [getUint]),
			).types.map((t) => t.name);

			expect(names).toContain("Outer");
			expect(names).toContain("Inner");
			expect(names).not.toContain("Dropped");
		});

		it("keeps structs referenced by list types, functions and non-struct types", () => {
			const names = pruneSchema(
				schema,
				footprintOf("erc20", [balanceOf]),
			).types.map((t) => t.name);

			expect(names).toContain("Listed");
			expect(names).toContain("FromFunction");
			expect(names).toContain("sol_address");
			expect(names).not.toContain("Outer");
		});

		it("throws on an unknown contract", () => {
			expect(() =>
				pruneSchema(schema, footprintOf("nope", [balanceOf])),
			).toThrow(/unknown contract "nope"/);
		});

		it("throws on an unknown method naming its signature", () => {
			expect(() =>
				pruneSchema(schema, footprintOf("erc20", [getUint])),
			).toThrow(/unknown method "erc20.get\(uint256\)"/);
		});

		it("does not mutate the input", () => {
			const copy = structuredClone(schema);

			pruneSchema(schema, footprintOf("erc20", [balanceOf]));

			expect(schema).toEqual(copy);
		});
	});
});
