import { parseAbi } from "viem";
import { describe, expect, it } from "vitest";

import { buildSchema } from "./builder.js";

import type { Abi } from "viem";

const SIMPLE_ABI: Abi = [
	{
		type: "function",
		name: "balanceOf",
		stateMutability: "view",
		inputs: [{ name: "account", type: "address" }],
		outputs: [{ name: "", type: "uint256" }],
	},
	{
		type: "function",
		name: "totalSupply",
		stateMutability: "view",
		inputs: [],
		outputs: [{ name: "", type: "uint256" }],
	},
	{
		type: "function",
		name: "name",
		stateMutability: "view",
		inputs: [],
		outputs: [{ name: "", type: "string" }],
	},
];

/**
 * Comprehensive ABI covering all struct return scenarios:
 * - tuple return (getPool)
 * - multi-return (getReserves)
 * - nested tuple (getInfo)
 * - tuple[] return (getPositions)
 * - tuple with tuple[] field (getAccount)
 */
const STRUCT_ABI: Abi = [
	{
		type: "function",
		name: "getPool",
		stateMutability: "view",
		inputs: [{ name: "id", type: "uint256" }],
		outputs: [
			{
				name: "",
				type: "tuple",
				components: [
					{ name: "token", type: "address" },
					{ name: "balance", type: "uint256" },
				],
			},
		],
	},
	{
		type: "function",
		name: "getReserves",
		stateMutability: "view",
		inputs: [],
		outputs: [
			{ name: "reserve0", type: "uint112" },
			{ name: "reserve1", type: "uint112" },
			{ name: "blockTimestampLast", type: "uint32" },
		],
	},
	{
		type: "function",
		name: "getInfo",
		stateMutability: "view",
		inputs: [],
		outputs: [
			{
				name: "",
				type: "tuple",
				components: [
					{ name: "id", type: "uint256" },
					{
						name: "details",
						type: "tuple",
						components: [
							{ name: "token", type: "address" },
							{ name: "amount", type: "uint256" },
						],
					},
				],
			},
		],
	},
	{
		type: "function",
		name: "getPositions",
		stateMutability: "view",
		inputs: [{ name: "user", type: "address" }],
		outputs: [
			{
				name: "",
				type: "tuple[]",
				components: [
					{ name: "token", type: "address" },
					{ name: "amount", type: "uint256" },
				],
			},
		],
	},
	{
		type: "function",
		name: "getAccount",
		stateMutability: "view",
		inputs: [],
		outputs: [
			{
				name: "",
				type: "tuple",
				components: [
					{ name: "owner", type: "address" },
					{
						name: "positions",
						type: "tuple[]",
						components: [
							{ name: "token", type: "address" },
							{ name: "amount", type: "uint256" },
						],
					},
				],
			},
		],
	},
];

describe("src/builder.ts", () => {
	describe("contracts", () => {
		it("builds a schema with the correct contract name and method count", () => {
			const schema = buildSchema({
				contracts: {
					erc20: {
						address: "0x6B175474E89094C44Da98b954EedeAC495271d0F",
						abi: SIMPLE_ABI,
					},
				},
			});

			expect(schema.version).toBe("1.0.0");
			expect(schema.contracts).toHaveLength(1);
			expect(schema.contracts[0]?.name).toBe("erc20");
			expect(schema.contracts[0]?.methods).toHaveLength(3);
		});

		it("includes contract description", () => {
			const schema = buildSchema({
				contracts: {
					erc20: {
						address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
						abi: SIMPLE_ABI,
						description: "ERC-20 Token",
					},
				},
			});

			expect(schema.contracts[0]?.description).toBe("ERC-20 Token");
		});

		it("handles empty config", () => {
			const schema = buildSchema({});

			expect(schema.contracts).toEqual([]);
			expect(schema.variables).toEqual([]);
			expect(schema.version).toBe("1.0.0");
		});

		it("includes builtin types, functions, and macros", () => {
			const schema = buildSchema({});

			expect(schema.types.length).toBeGreaterThan(0);
			expect(schema.functions.length).toBeGreaterThan(0);
			expect(schema.macros.length).toBeGreaterThan(0);
		});

		it("only includes view and pure functions (excludes nonpayable, payable, events)", () => {
			const schema = buildSchema({
				contracts: {
					c: {
						address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
						abi: [
							{
								type: "function",
								name: "viewFn",
								stateMutability: "view",
								inputs: [],
								outputs: [{ name: "", type: "uint256" }],
							},
							{
								type: "function",
								name: "pureFn",
								stateMutability: "pure",
								inputs: [],
								outputs: [{ name: "", type: "bool" }],
							},
							{
								type: "function",
								name: "nonpayableFn",
								stateMutability: "nonpayable",
								inputs: [],
								outputs: [],
							},
							{
								type: "function",
								name: "payableFn",
								stateMutability: "payable",
								inputs: [],
								outputs: [],
							},
							{
								type: "event",
								name: "Transfer",
								inputs: [],
							},
						],
					},
				},
			});

			const methodNames = schema.contracts[0]?.methods.map((m) => m.name);
			expect(methodNames).toContain("viewFn");
			expect(methodNames).toContain("pureFn");
			expect(methodNames).not.toContain("nonpayableFn");
			expect(methodNames).not.toContain("payableFn");
			expect(methodNames).not.toContain("Transfer");
		});

		it("maps unnamed params to arg{index}", () => {
			const schema = buildSchema({
				contracts: {
					c: {
						address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
						abi: [
							{
								type: "function",
								name: "foo",
								stateMutability: "view",
								inputs: [
									{ name: "", type: "address" },
									{ name: "", type: "uint256" },
								],
								outputs: [{ name: "", type: "bool" }],
							},
						],
					},
				},
			});

			const params = schema.contracts[0]?.methods[0]?.params;
			expect(params?.[0]?.name).toBe("arg0");
			expect(params?.[1]?.name).toBe("arg1");
		});
	});

	describe("method param and return types (CEL types)", () => {
		const schema = buildSchema({
			contracts: {
				token: {
					address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
					abi: SIMPLE_ABI,
				},
			},
		});

		it("maps address param to sol_address", () => {
			const method = schema.contracts[0]?.methods.find(
				(m) => m.name === "balanceOf",
			);
			expect(method?.params[0]?.name).toBe("account");
			expect(method?.params[0]?.type).toBe("sol_address");
		});

		it.each([
			["balanceOf", "sol_int"],
			["totalSupply", "sol_int"],
			["name", "string"],
		])("%s returns %s", (methodName, expectedReturn) => {
			const method = schema.contracts[0]?.methods.find(
				(m) => m.name === methodName,
			);
			expect(method?.returns).toBe(expectedReturn);
		});
	});

	describe("context variables", () => {
		it("builds a schema with context variables", () => {
			const schema = buildSchema({
				context: {
					user: "sol_address",
					amount: "sol_int",
				},
			});

			expect(schema.variables).toHaveLength(2);
			expect(schema.variables).toEqual(
				expect.arrayContaining([
					expect.objectContaining({ name: "user", type: "sol_address" }),
					expect.objectContaining({ name: "amount", type: "sol_int" }),
				]),
			);
		});

		it("builds a schema with both contracts and context", () => {
			const schema = buildSchema({
				contracts: {
					erc20: {
						address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
						abi: SIMPLE_ABI,
					},
				},
				context: {
					user: "sol_address",
				},
			});

			expect(schema.contracts).toHaveLength(1);
			expect(schema.variables).toHaveLength(1);
		});
	});

	describe("struct returns", () => {
		const schema = buildSchema({
			contracts: {
				vault: {
					address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
					abi: STRUCT_ABI,
				},
			},
		});

		it("generates TypeSchema for struct-returning method", () => {
			const structType = schema.types.find(
				(t) => t.name === "SEL_Struct_vault_getPool",
			);

			expect(structType).toBeDefined();
			expect(structType?.kind).toBe("struct");
		});

		it("sets method returns to struct type name", () => {
			const method = schema.contracts[0]?.methods.find(
				(m) => m.name === "getPool",
			);

			expect(method?.returns).toBe("SEL_Struct_vault_getPool");
		});

		it("struct fields use CEL types (sol_address, sol_int)", () => {
			const structType = schema.types.find(
				(t) => t.name === "SEL_Struct_vault_getPool",
			);

			expect(structType?.fields).toEqual(
				expect.arrayContaining([
					{ name: "token", type: "sol_address" },
					{ name: "balance", type: "sol_int" },
				]),
			);
		});

		it("generates TypeSchema for multi-return method", () => {
			const structType = schema.types.find(
				(t) => t.name === "SEL_Struct_vault_getReserves",
			);

			expect(structType).toBeDefined();
			expect(structType?.kind).toBe("struct");
			expect(structType?.fields).toHaveLength(3);
			expect(structType?.fields).toEqual(
				expect.arrayContaining([
					{ name: "reserve0", type: "sol_int" },
					{ name: "reserve1", type: "sol_int" },
					{ name: "blockTimestampLast", type: "sol_int" },
				]),
			);
		});

		it("does not generate struct types for simple returns", () => {
			const simpleSchema = buildSchema({
				contracts: {
					erc20: {
						address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
						abi: SIMPLE_ABI,
					},
				},
			});

			const structTypes = simpleSchema.types.filter((t) => t.kind === "struct");
			expect(structTypes).toHaveLength(0);
		});

		it("emits struct type name for struct method and CEL type for simple method", () => {
			const mixedSchema = buildSchema({
				contracts: {
					token: {
						address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
						abi: SIMPLE_ABI,
					},
					pool: {
						address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
						abi: STRUCT_ABI,
					},
				},
			});

			const balanceOf = mixedSchema.contracts
				.find((c) => c.name === "token")
				?.methods.find((m) => m.name === "balanceOf");

			expect(balanceOf?.returns).toBe("sol_int");

			const getPool = mixedSchema.contracts
				.find((c) => c.name === "pool")
				?.methods.find((m) => m.name === "getPool");

			expect(getPool?.returns).toBe("SEL_Struct_pool_getPool");
		});

		it("generates nested struct TypeSchema entries", () => {
			const parentType = schema.types.find(
				(t) => t.name === "SEL_Struct_vault_getInfo",
			);

			expect(parentType).toBeDefined();
			expect(parentType?.kind).toBe("struct");

			const nestedType = schema.types.find(
				(t) => t.name === "SEL_Struct_vault_getInfo__details",
			);

			expect(nestedType).toBeDefined();
			expect(nestedType?.kind).toBe("struct");
			expect(nestedType?.fields).toEqual(
				expect.arrayContaining([
					{ name: "token", type: "sol_address" },
					{ name: "amount", type: "sol_int" },
				]),
			);

			const detailsField = parentType?.fields?.find(
				(f) => f.name === "details",
			);

			expect(detailsField?.type).toBe("SEL_Struct_vault_getInfo__details");
		});

		it("generates list<struct> return for tuple[] method", () => {
			const method = schema.contracts[0]?.methods.find(
				(m) => m.name === "getPositions",
			);
			expect(method?.returns).toBe("list<SEL_Struct_vault_getPositions>");
		});

		it("registers struct type for tuple[] return", () => {
			const structType = schema.types.find(
				(t) => t.name === "SEL_Struct_vault_getPositions",
			);

			expect(structType).toBeDefined();
			expect(structType?.kind).toBe("struct");
			expect(structType?.fields).toEqual(
				expect.arrayContaining([
					{ name: "token", type: "sol_address" },
					{ name: "amount", type: "sol_int" },
				]),
			);
		});

		it("resolves tuple[] field inside struct to list<nested struct>", () => {
			const parentType = schema.types.find(
				(t) => t.name === "SEL_Struct_vault_getAccount",
			);

			const positionsField = parentType?.fields?.find(
				(f) => f.name === "positions",
			);

			expect(positionsField?.type).toBe(
				"list<SEL_Struct_vault_getAccount__positions>",
			);
		});

		it("registers nested struct type for tuple[] field", () => {
			const nestedType = schema.types.find(
				(t) => t.name === "SEL_Struct_vault_getAccount__positions",
			);

			expect(nestedType).toBeDefined();
			expect(nestedType?.kind).toBe("struct");
			expect(nestedType?.fields).toEqual(
				expect.arrayContaining([
					{ name: "token", type: "sol_address" },
					{ name: "amount", type: "sol_int" },
				]),
			);
		});

		it("nested struct types appear before parent in types array", () => {
			const typeNames = schema.types.map((t) => t.name);
			const nestedIdx = typeNames.indexOf("SEL_Struct_vault_getInfo__details");
			const parentIdx = typeNames.indexOf("SEL_Struct_vault_getInfo");

			expect(nestedIdx).toBeGreaterThan(-1);
			expect(parentIdx).toBeGreaterThan(-1);
			expect(nestedIdx).toBeLessThan(parentIdx);
		});

		it("includes AbiFunction on method schema", () => {
			const abi = parseAbi([
				"function balanceOf(address owner) view returns (uint256)",
			]);
			const schema = buildSchema({
				contracts: {
					token: { address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", abi },
				},
			});
			const method = schema.contracts[0]!.methods[0]!;
			expect(method.abi).toBeDefined();
			expect(method.abi.name).toBe("balanceOf");
			expect(method.abi.type).toBe("function");
		});
	});
});
