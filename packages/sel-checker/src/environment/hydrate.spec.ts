import { describe, expect, it } from "vitest";

import {
	createCheckerEnvironment,
	createRuntimeEnvironment,
} from "./hydrate.js";

import type { ContractSchema, MethodSchema, SELSchema } from "@seljs/schema";

/**
 * Creates a method schema for checker tests.
 * The `abi` field is required by MethodSchema but unused by the checker,
 * so we omit it here and cast to satisfy the type.
 */
const method = (m: Omit<MethodSchema, "abi">): MethodSchema =>
	m as MethodSchema;

/**
 * Creates a contract schema for checker tests.
 * The `address` field is required by ContractSchema but unused by the checker,
 * so we omit it here and cast to satisfy the type.
 */
const contract = (c: Omit<ContractSchema, "address">): ContractSchema =>
	c as ContractSchema;

const makeSchema = (overrides?: Partial<SELSchema>): SELSchema => ({
	version: "1.0.0",
	contracts: [],
	variables: [],
	types: [],
	functions: [],
	macros: [],
	...overrides,
});

describe("src/environment/hydrate.ts", () => {
	describe("hydrateEnvironment", () => {
		it("creates an environment from an empty schema", () => {
			const env = createCheckerEnvironment(makeSchema());
			expect(env).toBeDefined();
		});

		it("can type-check basic arithmetic after hydration", () => {
			const env = createCheckerEnvironment(makeSchema());
			const result = env.check("1 + 2");

			expect(result.valid).toBe(true);
			expect(result.type).toBe("int");
		});

		it("registers Solidity types", () => {
			const env = createCheckerEnvironment(makeSchema());

			// uint256 arithmetic should type-check
			env.registerVariable("x", "int");
			env.registerVariable("y", "int");
			const result = env.check("x + y");

			expect(result.valid).toBe(true);
			expect(result.type).toBe("int");
		});

		it("registers schema variables", () => {
			const env = createCheckerEnvironment(
				makeSchema({
					variables: [
						{ name: "user", type: "sol_address" },
						{ name: "amount", type: "sol_int" },
					],
				}),
			);

			expect(env.hasVariable("user")).toBe(true);
			expect(env.hasVariable("amount")).toBe(true);
		});

		it("falls back to dyn for unknown variable types", () => {
			const env = createCheckerEnvironment(
				makeSchema({
					variables: [{ name: "custom", type: "CustomType" }],
				}),
			);

			expect(env.hasVariable("custom")).toBe(true);
		});

		it("registers contract types and methods", () => {
			const env = createCheckerEnvironment(
				makeSchema({
					contracts: [
						contract({
							name: "erc20",
							methods: [
								method({
									name: "balanceOf",
									params: [{ name: "account", type: "sol_address" }],
									returns: "sol_int",
								}),
								method({
									name: "totalSupply",
									params: [],
									returns: "sol_int",
								}),
							],
						}),
					],
				}),
			);

			// The contract should be registered as a variable
			expect(env.hasVariable("erc20")).toBe(true);

			// Should be able to type-check method calls
			const result = env.check("erc20.totalSupply()");
			expect(result.valid).toBe(true);
			expect(result.type).toBe("sol_int");
		});

		it("registers schema receiver functions for type-checking", () => {
			const env = createCheckerEnvironment(
				makeSchema({
					variables: [{ name: "greeting", type: "string" }],
					functions: [
						{
							name: "customMethod",
							signature: "string.customMethod(): bool",
							params: [],
							returns: "bool",
							receiverType: "string",
						},
					],
				}),
			);

			const result = env.check("greeting.customMethod()");
			expect(result.valid).toBe(true);
			expect(result.type).toBe("bool");
		});

		it("does not expose a 'name' field on contract types", () => {
			const env = createCheckerEnvironment(
				makeSchema({
					contracts: [
						contract({
							name: "erc20",
							methods: [
								method({
									name: "name",
									params: [],
									returns: "string",
								}),
							],
						}),
					],
				}),
			);

			// erc20.name() (method call) should be valid
			const callResult = env.check("erc20.name()");
			expect(callResult.valid).toBe(true);
			expect(callResult.type).toBe("string");

			// erc20.name (field access without parens) should NOT be valid
			const fieldResult = env.check("erc20.name");
			expect(fieldResult.valid).toBe(false);
		});

		it("type-checks contract method with params", () => {
			const env = createCheckerEnvironment(
				makeSchema({
					contracts: [
						contract({
							name: "token",
							methods: [
								method({
									name: "balanceOf",
									params: [{ name: "account", type: "sol_address" }],
									returns: "sol_int",
								}),
							],
						}),
					],
					variables: [{ name: "user", type: "sol_address" }],
				}),
			);

			const result = env.check("token.balanceOf(user)");
			expect(result.valid).toBe(true);
			expect(result.type).toBe("sol_int");
		});

		it("registers CEL literal type overloads for checker", () => {
			const env = createCheckerEnvironment(
				makeSchema({
					contracts: [
						contract({
							name: "token",
							methods: [
								method({
									name: "balanceOf",
									params: [{ name: "account", type: "sol_address" }],
									returns: "sol_int",
								}),
							],
						}),
					],
				}),
			);

			const result = env.check(
				'token.balanceOf("0x0000000000000000000000000000000000000001")',
			);
			expect(result.valid).toBe(true);
		});
	});

	describe("struct return type-checking", () => {
		it("type-checks struct field access on method return", () => {
			const env = createCheckerEnvironment(
				makeSchema({
					types: [
						{
							name: "SEL_Struct_pool_getPool",
							kind: "struct",
							fields: [
								{ name: "token", type: "sol_address" },
								{ name: "balance", type: "sol_int" },
							],
						},
					],
					contracts: [
						contract({
							name: "pool",
							methods: [
								method({
									name: "getPool",
									params: [{ name: "id", type: "sol_int" }],
									returns: "SEL_Struct_pool_getPool",
								}),
							],
						}),
					],
				}),
			);

			const result = env.check("pool.getPool(solInt(1)).token");
			expect(result.valid).toBe(true);
			expect(result.type).toBe("sol_address");
		});

		it("type-checks struct method return as struct type", () => {
			const env = createCheckerEnvironment(
				makeSchema({
					types: [
						{
							name: "SEL_Struct_pool_getPool",
							kind: "struct",
							fields: [
								{ name: "token", type: "sol_address" },
								{ name: "balance", type: "sol_int" },
							],
						},
					],
					contracts: [
						contract({
							name: "pool",
							methods: [
								method({
									name: "getPool",
									params: [{ name: "id", type: "sol_int" }],
									returns: "SEL_Struct_pool_getPool",
								}),
							],
						}),
					],
				}),
			);

			const result = env.check("pool.getPool(solInt(1))");
			expect(result.valid).toBe(true);
			expect(result.type).toBe("SEL_Struct_pool_getPool");
		});

		it("rejects invalid struct field access", () => {
			const env = createCheckerEnvironment(
				makeSchema({
					types: [
						{
							name: "SEL_Struct_pool_getPool",
							kind: "struct",
							fields: [
								{ name: "token", type: "sol_address" },
								{ name: "balance", type: "sol_int" },
							],
						},
					],
					contracts: [
						contract({
							name: "pool",
							methods: [
								method({
									name: "getPool",
									params: [{ name: "id", type: "sol_int" }],
									returns: "SEL_Struct_pool_getPool",
								}),
							],
						}),
					],
				}),
			);

			const result = env.check("pool.getPool(solInt(1)).nonexistent");
			expect(result.valid).toBe(false);
		});

		it("type-checks multi-return field access", () => {
			const env = createCheckerEnvironment(
				makeSchema({
					types: [
						{
							name: "SEL_Struct_pair_getReserves",
							kind: "struct",
							fields: [
								{ name: "reserve0", type: "sol_int" },
								{ name: "reserve1", type: "sol_int" },
								{ name: "blockTimestampLast", type: "sol_int" },
							],
						},
					],
					contracts: [
						contract({
							name: "pair",
							methods: [
								method({
									name: "getReserves",
									params: [],
									returns: "SEL_Struct_pair_getReserves",
								}),
							],
						}),
					],
				}),
			);

			const result = env.check("pair.getReserves().reserve0");
			expect(result.valid).toBe(true);
			expect(result.type).toBe("sol_int");
		});

		it("resolves nested field types correctly", () => {
			const env = createCheckerEnvironment(
				makeSchema({
					types: [
						{
							name: "SEL_Struct_pool_getPool",
							kind: "struct",
							fields: [
								{ name: "token", type: "sol_address" },
								{ name: "balance", type: "sol_int" },
							],
						},
					],
					contracts: [
						contract({
							name: "pool",
							methods: [
								method({
									name: "getPool",
									params: [{ name: "id", type: "sol_int" }],
									returns: "SEL_Struct_pool_getPool",
								}),
							],
						}),
					],
				}),
			);

			const result = env.check("pool.getPool(solInt(1)).balance");
			expect(result.valid).toBe(true);
			expect(result.type).toBe("sol_int");
		});

		it("type-checks nested struct field access", () => {
			const env = createCheckerEnvironment(
				makeSchema({
					types: [
						{
							name: "SEL_Struct_contract_getInfo__details",
							kind: "struct",
							fields: [
								{ name: "token", type: "sol_address" },
								{ name: "amount", type: "sol_int" },
							],
						},
						{
							name: "SEL_Struct_contract_getInfo",
							kind: "struct",
							fields: [
								{ name: "id", type: "sol_int" },
								{
									name: "details",
									type: "SEL_Struct_contract_getInfo__details",
								},
							],
						},
					],
					contracts: [
						contract({
							name: "contract",
							methods: [
								method({
									name: "getInfo",
									params: [],
									returns: "SEL_Struct_contract_getInfo",
								}),
							],
						}),
					],
				}),
			);

			const result = env.check("contract.getInfo().details.token");
			expect(result.valid).toBe(true);
			expect(result.type).toBe("sol_address");
		});

		it("rejects invalid nested struct field access", () => {
			const env = createCheckerEnvironment(
				makeSchema({
					types: [
						{
							name: "SEL_Struct_contract_getInfo__details",
							kind: "struct",
							fields: [
								{ name: "token", type: "sol_address" },
								{ name: "amount", type: "sol_int" },
							],
						},
						{
							name: "SEL_Struct_contract_getInfo",
							kind: "struct",
							fields: [
								{ name: "id", type: "sol_int" },
								{
									name: "details",
									type: "SEL_Struct_contract_getInfo__details",
								},
							],
						},
					],
					contracts: [
						contract({
							name: "contract",
							methods: [
								method({
									name: "getInfo",
									params: [],
									returns: "SEL_Struct_contract_getInfo",
								}),
							],
						}),
					],
				}),
			);

			const result = env.check("contract.getInfo().details.nonexistent");
			expect(result.valid).toBe(false);
		});
	});

	describe("createRuntimeEnvironment", () => {
		it("creates an environment with a handler", () => {
			const { env } = createRuntimeEnvironment(makeSchema(), () => undefined);
			expect(env).toBeDefined();
		});

		it("registers CEL literal type overloads for SolidityAddress params", () => {
			const { env } = createRuntimeEnvironment(
				makeSchema({
					contracts: [
						contract({
							name: "token",
							methods: [
								method({
									name: "balanceOf",
									params: [{ name: "account", type: "sol_address" }],
									returns: "sol_int",
								}),
							],
						}),
					],
				}),
				() => 42n,
			);

			// Should type-check with string literal (CEL literal overload for SolidityAddress)
			const result = env.check(
				'token.balanceOf("0x0000000000000000000000000000000000000001")',
			);
			expect(result.valid).toBe(true);
		});

		it("type-checks the same as checker environment", () => {
			const schema = makeSchema({
				contracts: [
					contract({
						name: "erc20",
						methods: [
							method({ name: "totalSupply", params: [], returns: "sol_int" }),
							method({
								name: "balanceOf",
								params: [{ name: "account", type: "sol_address" }],
								returns: "sol_int",
							}),
						],
					}),
				],
				variables: [{ name: "user", type: "sol_address" }],
			});

			const checkerEnv = createCheckerEnvironment(schema);
			const { env: runtimeEnv } = createRuntimeEnvironment(
				schema,
				() => undefined,
			);

			const expressions = [
				"erc20.totalSupply()",
				"erc20.balanceOf(user)",
				"user",
			];

			for (const expr of expressions) {
				const checkerResult = checkerEnv.check(expr);
				const runtimeResult = runtimeEnv.check(expr);
				expect(runtimeResult.valid).toBe(checkerResult.valid);
				expect(runtimeResult.type).toBe(checkerResult.type);
			}
		});
	});
});
