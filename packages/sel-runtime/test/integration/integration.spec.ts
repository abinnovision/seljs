import { buildSchema } from "@seljs/env";
import {
	createE2EMockClient,
	buildRoutes,
	routeFor,
} from "@seljs-internal/fixtures";
import { Abi } from "ox";
import { describe, expect, it } from "vitest";

import {
	CircularDependencyError,
	createSEL,
	ExecutionLimitError,
	MulticallBatchError,
	SELContractError,
} from "../../src/index.js";

const ERC20_ABI = Abi.from([
	"function balanceOf(address account) view returns (uint256)",
	"function totalSupply() view returns (uint256)",
]);

const STAKING_ABI = Abi.from([
	"function balanceOf(address account) view returns (uint256)",
	"function rewardRate() view returns (uint256)",
]);

const NFT_ABI = Abi.from([
	"function ownerOf(uint256 tokenId) view returns (address)",
	"function balanceOf(address owner) view returns (uint256)",
]);

const STAKING_V2_ABI = Abi.from([
	"function stakedTokenId(address user) view returns (uint256)",
]);

const TOKEN_ADDRESS = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48" as const;
const STAKING_ADDRESS = "0x7D1AfA7B718fb893dB30A3aBc0Cfc608AaCfeBB0" as const;
const USER_ADDRESS = "0x0000000000000000000000000000000000000002" as const;

describe("integration", () => {
	describe("contract evaluation", () => {
		it("evaluates contract call with registered variable", async () => {
			const routes = buildRoutes(
				routeFor({
					abi: ERC20_ABI,
					functionName: "balanceOf",
					address: TOKEN_ADDRESS,
					result: 1000n,
				}),
			);
			const { client } = createE2EMockClient(routes);

			const sel = createSEL({
				client,
				schema: buildSchema({
					contracts: {
						token: {
							address: TOKEN_ADDRESS,
							abi: ERC20_ABI,
						},
					},
					context: {
						user: "sol_address",
						threshold: "sol_int",
					},
				}),
			});

			const result = await sel.evaluate<boolean>(
				"token.balanceOf(user) > threshold",
				{ user: USER_ADDRESS, threshold: 0n },
			);

			expect(result.value).toBe(true);
		});

		it("evaluates contract call returning bigint", async () => {
			const routes = buildRoutes(
				routeFor({
					abi: ERC20_ABI,
					functionName: "totalSupply",
					address: TOKEN_ADDRESS,
					result: 10n ** 18n,
				}),
			);
			const { client } = createE2EMockClient(routes);

			const sel = createSEL({
				client,
				schema: buildSchema({
					contracts: {
						token: { address: TOKEN_ADDRESS, abi: ERC20_ABI },
					},
				}),
			});

			const result = await sel.evaluate<bigint>("token.totalSupply()");
			expect(result.value).toBe(10n ** 18n);
		});

		it("combines contract call result with arithmetic", async () => {
			const routes = buildRoutes(
				routeFor({
					abi: ERC20_ABI,
					functionName: "balanceOf",
					address: TOKEN_ADDRESS,
					result: 500n,
				}),
			);
			const { client } = createE2EMockClient(routes);

			const sel = createSEL({
				client,
				schema: buildSchema({
					context: {
						user: "sol_address",
						multiplier: "sol_int",
					},
					contracts: {
						token: { address: TOKEN_ADDRESS, abi: ERC20_ABI },
					},
				}),
			});

			const result = await sel.evaluate<bigint>(
				"token.balanceOf(user) * multiplier",
				{ user: USER_ADDRESS, multiplier: 2n },
			);

			expect(result.value).toBe(1000n);
		});

		it("accepts solInt() cast for uint256 contract arguments", () => {
			const abi = Abi.from([
				"function balanceOf(address account, uint256 id) view returns (uint256)",
			]);

			const sel = createSEL({
				schema: buildSchema({
					contracts: {
						bobu: {
							address: "0x2079812353e2c9409a788fbf5f383fa62ad85be8",
							abi,
						},
					},
					context: {
						user: "sol_address",
						threshold: "sol_int",
					},
				}),
			});

			const result = sel.check("bobu.balanceOf(user, solInt(0)) > threshold");
			expect(result.valid).toBe(true);
			expect(result.type).toBe("bool");
		});
	});

	describe("polymorphic dispatch", () => {
		it("dispatches balanceOf to correct contract based on receiver", async () => {
			const routes = buildRoutes(
				routeFor({
					abi: ERC20_ABI,
					functionName: "balanceOf",
					address: TOKEN_ADDRESS,
					result: 1000n,
				}),
				routeFor({
					abi: STAKING_ABI,
					functionName: "balanceOf",
					address: STAKING_ADDRESS,
					result: 500n,
				}),
			);
			const { client } = createE2EMockClient(routes);

			const sel = createSEL({
				client,
				schema: buildSchema({
					context: { user: "sol_address" },
					contracts: {
						token: { address: TOKEN_ADDRESS, abi: ERC20_ABI },
						staking: { address: STAKING_ADDRESS, abi: STAKING_ABI },
					},
				}),
			});

			const tokenBalance = await sel.evaluate<bigint>("token.balanceOf(user)", {
				user: USER_ADDRESS,
			});
			const stakingBalance = await sel.evaluate<bigint>(
				"staking.balanceOf(user)",
				{ user: USER_ADDRESS },
			);

			expect(tokenBalance.value).toBe(1000n);
			expect(stakingBalance.value).toBe(500n);
		});

		it("compares results from two different contracts", async () => {
			const routes = buildRoutes(
				routeFor({
					abi: ERC20_ABI,
					functionName: "balanceOf",
					address: TOKEN_ADDRESS,
					result: 1000n,
				}),
				routeFor({
					abi: STAKING_ABI,
					functionName: "balanceOf",
					address: STAKING_ADDRESS,
					result: 500n,
				}),
			);
			const { client } = createE2EMockClient(routes);

			const sel = createSEL({
				client,
				schema: buildSchema({
					context: { user: "sol_address" },
					contracts: {
						token: { address: TOKEN_ADDRESS, abi: ERC20_ABI },
						staking: { address: STAKING_ADDRESS, abi: STAKING_ABI },
					},
				}),
			});

			const result = await sel.evaluate<boolean>(
				"token.balanceOf(user) > staking.balanceOf(user)",
				{ user: USER_ADDRESS },
			);

			expect(result.value).toBe(true);
		});
	});

	describe("multi-round execution", () => {
		const NFT_ADDRESS = "0x1111111111111111111111111111111111111111" as const;
		const STAKING_V2_ADDRESS =
			"0x2222222222222222222222222222222222222222" as const;
		const OWNER_ADDRESS = "0xd8da6bf26964af9d7eed9e03e53415d37aa96045" as const;

		it("resolves dependent calls across multiple rounds", async () => {
			const routes = buildRoutes(
				routeFor({
					abi: STAKING_V2_ABI,
					functionName: "stakedTokenId",
					address: STAKING_V2_ADDRESS,
					result: 5n,
				}),
				routeFor({
					abi: NFT_ABI,
					functionName: "ownerOf",
					address: NFT_ADDRESS,
					result: OWNER_ADDRESS,
				}),
			);
			const { client, callLog } = createE2EMockClient(routes);

			const sel = createSEL({
				client,
				schema: buildSchema({
					context: { user: "sol_address" },
					contracts: {
						staking: { address: STAKING_V2_ADDRESS, abi: STAKING_V2_ABI },
						nft: { address: NFT_ADDRESS, abi: NFT_ABI },
					},
				}),
			});

			const result = await sel.evaluate<string>(
				"nft.ownerOf(staking.stakedTokenId(user))",
				{ user: USER_ADDRESS },
			);

			expect(result.value).toBe(OWNER_ADDRESS);
			expect(callLog).toHaveLength(2);
		});

		it("executes independent calls in the same round", async () => {
			const routes = buildRoutes(
				routeFor({
					abi: ERC20_ABI,
					functionName: "balanceOf",
					address: TOKEN_ADDRESS,
					result: 100n,
				}),
				routeFor({
					abi: NFT_ABI,
					functionName: "balanceOf",
					address: NFT_ADDRESS,
					result: 2n,
				}),
			);
			const { client } = createE2EMockClient(routes);

			const sel = createSEL({
				client,
				schema: buildSchema({
					context: { user: "sol_address" },
					contracts: {
						token: { address: TOKEN_ADDRESS, abi: ERC20_ABI },
						nft: { address: NFT_ADDRESS, abi: NFT_ABI },
					},
				}),
			});

			const result = await sel.evaluate<bigint>(
				"token.balanceOf(user) + nft.balanceOf(user)",
				{ user: USER_ADDRESS },
			);

			expect(result.value).toBe(102n);
		});

		it("deduplicates identical calls in expression", async () => {
			const routes = buildRoutes(
				routeFor({
					abi: STAKING_V2_ABI,
					functionName: "stakedTokenId",
					address: STAKING_V2_ADDRESS,
					result: 5n,
				}),
				routeFor({
					abi: NFT_ABI,
					functionName: "ownerOf",
					address: NFT_ADDRESS,
					result: OWNER_ADDRESS,
				}),
			);
			const { client, callLog } = createE2EMockClient(routes);

			const sel = createSEL({
				client,
				schema: buildSchema({
					context: { user: "sol_address" },
					contracts: {
						staking: { address: STAKING_V2_ADDRESS, abi: STAKING_V2_ABI },
						nft: { address: NFT_ADDRESS, abi: NFT_ABI },
					},
				}),
			});

			const result = await sel.evaluate<boolean>(
				"nft.ownerOf(staking.stakedTokenId(user)) == nft.ownerOf(staking.stakedTokenId(user))",
				{ user: USER_ADDRESS },
			);

			expect(result.value).toBe(true);
			expect(callLog).toHaveLength(2);
		});

		it("returns metadata when contract calls are executed", async () => {
			const routes = buildRoutes(
				routeFor({
					abi: ERC20_ABI,
					functionName: "balanceOf",
					address: TOKEN_ADDRESS,
					result: 100n,
				}),
			);
			const { client } = createE2EMockClient(routes);

			const sel = createSEL({
				client,
				schema: buildSchema({
					context: { user: "sol_address" },
					contracts: {
						token: { address: TOKEN_ADDRESS, abi: ERC20_ABI },
					},
				}),
			});

			const result = await sel.evaluate<bigint>("token.balanceOf(user)", {
				user: USER_ADDRESS,
			});

			expect(result.value).toBe(100n);
			expect(result.meta!.roundsExecuted).toBe(1);
			expect(result.meta!.totalCalls).toBe(1);
		});

		it("resolves diamond dependency pattern (shared deps in earlier round)", async () => {
			const AGG_A_ADDRESS =
				"0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" as const;
			const AGG_D_ADDRESS =
				"0xdddddddddddddddddddddddddddddddddddddddd" as const;
			const FEED_B_ADDRESS =
				"0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" as const;
			const FEED_C_ADDRESS =
				"0xcccccccccccccccccccccccccccccccccccccccc" as const;

			const AGG_ABI = Abi.from([
				"function scale(uint256 value) view returns (uint256)",
			]);
			const FEED_ABI = Abi.from(["function getPrice() view returns (uint256)"]);

			const routes = buildRoutes(
				routeFor({
					abi: FEED_ABI,
					functionName: "getPrice",
					address: FEED_B_ADDRESS,
					result: 50n,
				}),
				routeFor({
					abi: FEED_ABI,
					functionName: "getPrice",
					address: FEED_C_ADDRESS,
					result: 30n,
				}),
				routeFor({
					abi: AGG_ABI,
					functionName: "scale",
					address: AGG_A_ADDRESS,
					result: 500n,
				}),
				routeFor({
					abi: AGG_ABI,
					functionName: "scale",
					address: AGG_D_ADDRESS,
					result: 300n,
				}),
			);
			const { client, callLog } = createE2EMockClient(routes);

			const sel = createSEL({
				client,
				schema: buildSchema({
					contracts: {
						feedB: { address: FEED_B_ADDRESS, abi: FEED_ABI },
						feedC: { address: FEED_C_ADDRESS, abi: FEED_ABI },
						aggA: { address: AGG_A_ADDRESS, abi: AGG_ABI },
						aggD: { address: AGG_D_ADDRESS, abi: AGG_ABI },
					},
				}),
			});

			// Diamond: feedB+feedC in round 1 (independent), aggA+aggD in round 2 (depend on feeds)
			const result = await sel.evaluate<bigint>(
				"aggA.scale(feedB.getPrice()) + aggD.scale(feedC.getPrice())",
			);

			expect(result.value).toBe(800n);
			expect(callLog).toHaveLength(4);
		});

		it("exports CircularDependencyError as a constructable error class", () => {
			const error = new CircularDependencyError(
				"Circular dependency detected among calls",
				{ callIds: ["call_0", "call_1", "call_2"] },
			);
			expect(error).toBeInstanceOf(CircularDependencyError);
			expect(error).toBeInstanceOf(Error);
			expect(error.name).toBe("CircularDependencyError");
			expect(error.callIds).toEqual(["call_0", "call_1", "call_2"]);
			expect(error.message).toContain("Circular dependency");
		});

		it("throws ExecutionLimitError when maxCalls is exceeded", async () => {
			const NFT_ADDRESS_LOCAL =
				"0x1111111111111111111111111111111111111111" as const;
			const routes = buildRoutes(
				routeFor({
					abi: ERC20_ABI,
					functionName: "balanceOf",
					address: TOKEN_ADDRESS,
					result: 100n,
				}),
				routeFor({
					abi: NFT_ABI,
					functionName: "balanceOf",
					address: NFT_ADDRESS_LOCAL,
					result: 2n,
				}),
			);
			const { client } = createE2EMockClient(routes);

			const sel = createSEL({
				client,
				limits: { maxCalls: 1 },
				schema: buildSchema({
					context: { user: "sol_address" },
					contracts: {
						token: { address: TOKEN_ADDRESS, abi: ERC20_ABI },
						nft: { address: NFT_ADDRESS_LOCAL, abi: NFT_ABI },
					},
				}),
			});

			await expect(
				sel.evaluate<bigint>("token.balanceOf(user) + nft.balanceOf(user)", {
					user: USER_ADDRESS,
				}),
			).rejects.toBeInstanceOf(ExecutionLimitError);
			await expect(
				sel.evaluate<bigint>("token.balanceOf(user) + nft.balanceOf(user)", {
					user: USER_ADDRESS,
				}),
			).rejects.toMatchObject({
				limitType: "maxCalls",
				limit: 1,
				actual: 2,
			});
		});

		describe("multicall batching", () => {
			it("batches independent calls into single Multicall3 RPC call", async () => {
				const NFT_ADDRESS_LOCAL =
					"0x1111111111111111111111111111111111111111" as const;
				const routes = buildRoutes(
					routeFor({
						abi: ERC20_ABI,
						functionName: "balanceOf",
						address: TOKEN_ADDRESS,
						result: 100n,
					}),
					routeFor({
						abi: NFT_ABI,
						functionName: "balanceOf",
						address: NFT_ADDRESS_LOCAL,
						result: 2n,
					}),
				);
				const { client, getRpcCallCount } = createE2EMockClient(routes);

				const sel = createSEL({
					client,
					schema: buildSchema({
						context: { user: "sol_address" },
						contracts: {
							token: { address: TOKEN_ADDRESS, abi: ERC20_ABI },
							nft: { address: NFT_ADDRESS_LOCAL, abi: NFT_ABI },
						},
					}),
				});

				const result = await sel.evaluate<bigint>(
					"token.balanceOf(user) + nft.balanceOf(user)",
					{ user: USER_ADDRESS },
				);

				expect(result.value).toBe(102n);
				expect(getRpcCallCount()).toBe(1);
			});

			it("uses separate Multicall3 RPC calls for each execution round", async () => {
				const routes = buildRoutes(
					routeFor({
						abi: STAKING_V2_ABI,
						functionName: "stakedTokenId",
						address: STAKING_V2_ADDRESS,
						result: 5n,
					}),
					routeFor({
						abi: NFT_ABI,
						functionName: "ownerOf",
						address: NFT_ADDRESS,
						result: OWNER_ADDRESS,
					}),
				);
				const { client, getRpcCallCount } = createE2EMockClient(routes);

				const sel = createSEL({
					client,
					schema: buildSchema({
						context: { user: "sol_address" },
						contracts: {
							staking: { address: STAKING_V2_ADDRESS, abi: STAKING_V2_ABI },
							nft: { address: NFT_ADDRESS, abi: NFT_ABI },
						},
					}),
				});

				const result = await sel.evaluate<string>(
					"nft.ownerOf(staking.stakedTokenId(user))",
					{ user: USER_ADDRESS },
				);

				expect(result.value).toBe(OWNER_ADDRESS);
				expect(getRpcCallCount()).toBe(2);
			});

			it("wraps MulticallBatchError in SELContractError on batch failure", async () => {
				const failingClient = {
					call: () => Promise.reject(new Error("RPC timeout")),
					getBlockNumber: () => Promise.resolve(100n),
				};

				const sel = createSEL({
					client: failingClient,
					schema: buildSchema({
						context: { user: "sol_address" },
						contracts: {
							token: { address: TOKEN_ADDRESS, abi: ERC20_ABI },
						},
					}),
				});

				await expect(
					sel.evaluate("token.balanceOf(user)", { user: USER_ADDRESS }),
				).rejects.toBeInstanceOf(SELContractError);
				await expect(
					sel.evaluate("token.balanceOf(user)", { user: USER_ADDRESS }),
				).rejects.toMatchObject({
					cause: expect.any(MulticallBatchError),
				});
			});
		});
	});

	describe("struct return types", () => {
		const POOL_ADDRESS = "0x1111111111111111111111111111111111111111" as const;
		const PAIR_ADDRESS = "0x2222222222222222222222222222222222222222" as const;
		const TOKEN_ADDR = "0x0000000000000000000000000000000000000001" as const;

		// ABI for a single-tuple return function (struct return)
		const STRUCT_POOL_ABI = [
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
		] as const;

		// ABI for a multi-return function (synthesized into struct)
		const MULTI_RETURN_PAIR_ABI = [
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
		] as const;

		const createPoolRoutes = () =>
			buildRoutes(
				routeFor({
					abi: STRUCT_POOL_ABI as unknown as Abi.Abi,
					functionName: "getPool",
					address: POOL_ADDRESS,
					result: { token: TOKEN_ADDR, balance: 500n },
				}),
			);

		const createPairRoutes = () =>
			buildRoutes(
				routeFor({
					abi: MULTI_RETURN_PAIR_ABI as unknown as Abi.Abi,
					functionName: "getReserves",
					address: PAIR_ADDRESS,
					result: [112n, 224n, 1000],
				}),
			);

		it("evaluates struct field access from single-tuple return", async () => {
			const { client } = createE2EMockClient(createPoolRoutes());

			const sel = createSEL({
				client,
				schema: buildSchema({
					contracts: {
						pool: {
							address: POOL_ADDRESS,
							abi: STRUCT_POOL_ABI as unknown as Abi.Abi,
						},
					},
				}),
			});

			const result = await sel.evaluate<string>(
				"pool.getPool(solInt(1)).token",
			);
			expect(result.value).toBe(TOKEN_ADDR);
		});

		it("evaluates uint256 field from struct return", async () => {
			const { client } = createE2EMockClient(createPoolRoutes());

			const sel = createSEL({
				client,
				schema: buildSchema({
					contracts: {
						pool: {
							address: POOL_ADDRESS,
							abi: STRUCT_POOL_ABI as unknown as Abi.Abi,
						},
					},
				}),
			});

			const result = await sel.evaluate<bigint>(
				"pool.getPool(solInt(1)).balance",
			);
			expect(result.value).toBe(500n);
		});

		it("evaluates multi-return struct field access", async () => {
			const { client } = createE2EMockClient(createPairRoutes());

			const sel = createSEL({
				client,
				schema: buildSchema({
					contracts: {
						pair: {
							address: PAIR_ADDRESS,
							abi: MULTI_RETURN_PAIR_ABI as unknown as Abi.Abi,
						},
					},
				}),
			});

			const result = await sel.evaluate<bigint>("pair.getReserves().reserve0");
			expect(result.value).toBe(112n);
		});

		it("accesses second field from multi-return struct", async () => {
			const { client } = createE2EMockClient(createPairRoutes());

			const sel = createSEL({
				client,
				schema: buildSchema({
					contracts: {
						pair: {
							address: PAIR_ADDRESS,
							abi: MULTI_RETURN_PAIR_ABI as unknown as Abi.Abi,
						},
					},
				}),
			});

			const result = await sel.evaluate<bigint>("pair.getReserves().reserve1");
			expect(result.value).toBe(224n);
		});

		it("type-checks struct field access", () => {
			const sel = createSEL({
				schema: buildSchema({
					contracts: {
						pool: {
							address: POOL_ADDRESS,
							abi: STRUCT_POOL_ABI as unknown as Abi.Abi,
						},
					},
				}),
			});

			const tokenCheck = sel.check("pool.getPool(solInt(1)).token");
			expect(tokenCheck.valid).toBe(true);

			const balanceCheck = sel.check("pool.getPool(solInt(1)).balance");
			expect(balanceCheck.valid).toBe(true);
		});

		it("uses struct field in boolean comparison", async () => {
			const { client } = createE2EMockClient(createPoolRoutes());

			const sel = createSEL({
				client,
				schema: buildSchema({
					contracts: {
						pool: {
							address: POOL_ADDRESS,
							abi: STRUCT_POOL_ABI as unknown as Abi.Abi,
						},
					},
				}),
			});

			const result = await sel.evaluate<boolean>(
				"pool.getPool(solInt(1)).balance > 0",
			);
			expect(result.value).toBe(true);
		});

		it("includes struct types in schema output", () => {
			const schema = buildSchema({
				contracts: {
					pool: {
						address: POOL_ADDRESS,
						abi: STRUCT_POOL_ABI as unknown as Abi.Abi,
					},
					pair: {
						address: PAIR_ADDRESS,
						abi: MULTI_RETURN_PAIR_ABI as unknown as Abi.Abi,
					},
				},
			});
			const structTypes = schema.types.filter((t) => t.kind === "struct");
			expect(structTypes.length).toBeGreaterThanOrEqual(2);

			const poolStruct = structTypes.find(
				(t) => t.name.includes("pool") && t.name.includes("getPool"),
			);
			expect(poolStruct).toBeDefined();
			expect(poolStruct!.fields).toBeDefined();
			expect(poolStruct!.fields!.length).toBe(2);

			const pairStruct = structTypes.find(
				(t) => t.name.includes("pair") && t.name.includes("getReserves"),
			);
			expect(pairStruct).toBeDefined();
			expect(pairStruct!.fields).toBeDefined();
			expect(pairStruct!.fields!.length).toBe(3);
		});
	});

	describe("parseUnits and formatUnits", () => {
		it("compares USDC balance against human-readable threshold with parseUnits", async () => {
			// User has 1500 USDC (6 decimals) = 1_500_000_000 raw
			const routes = buildRoutes(
				routeFor({
					abi: ERC20_ABI,
					functionName: "balanceOf",
					address: TOKEN_ADDRESS,
					result: 1_500_000_000n,
				}),
			);
			const { client } = createE2EMockClient(routes);

			const sel = createSEL({
				client,
				schema: buildSchema({
					context: { user: "sol_address" },
					contracts: {
						usdc: { address: TOKEN_ADDRESS, abi: ERC20_ABI },
					},
				}),
			});

			// "Does user have at least 1000 USDC?"
			const result = await sel.evaluate<boolean>(
				"usdc.balanceOf(user) >= parseUnits(1000, 6)",
				{ user: USER_ADDRESS },
			);
			expect(result.value).toBe(true);
		});

		it("compares ETH-scale balance with decimal parseUnits", async () => {
			// User has 2.5 WETH (18 decimals) = 2_500_000_000_000_000_000 raw
			const WETH_ADDRESS =
				"0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2" as const;
			const routes = buildRoutes(
				routeFor({
					abi: ERC20_ABI,
					functionName: "balanceOf",
					address: WETH_ADDRESS,
					result: 2_500_000_000_000_000_000n,
				}),
			);
			const { client } = createE2EMockClient(routes);

			const sel = createSEL({
				client,
				schema: buildSchema({
					context: { user: "sol_address" },
					contracts: {
						weth: { address: WETH_ADDRESS, abi: ERC20_ABI },
					},
				}),
			});

			// "Does user have at least 1.5 WETH?" — using decimal string
			const result = await sel.evaluate<boolean>(
				'weth.balanceOf(user) >= parseUnits("1.5", 18)',
				{ user: USER_ADDRESS },
			);
			expect(result.value).toBe(true);
		});

		it("uses formatUnits for readable balance threshold check", async () => {
			// User has 500 USDC (6 decimals) = 500_000_000 raw
			const routes = buildRoutes(
				routeFor({
					abi: ERC20_ABI,
					functionName: "balanceOf",
					address: TOKEN_ADDRESS,
					result: 500_000_000n,
				}),
			);
			const { client } = createE2EMockClient(routes);

			const sel = createSEL({
				client,
				schema: buildSchema({
					context: { user: "sol_address" },
					contracts: {
						usdc: { address: TOKEN_ADDRESS, abi: ERC20_ABI },
					},
				}),
			});

			// "Does user have at least 100.50 USDC?" — using formatUnits with double comparison
			const result = await sel.evaluate<boolean>(
				"formatUnits(usdc.balanceOf(user), 6) >= 100.50",
				{ user: USER_ADDRESS },
			);
			expect(result.value).toBe(true);
		});

		it("combines parseUnits with multi-contract comparison", async () => {
			// User has 1000 USDC and 200 staked tokens
			const routes = buildRoutes(
				routeFor({
					abi: ERC20_ABI,
					functionName: "balanceOf",
					address: TOKEN_ADDRESS,

					// 1000 USDC (6 decimals)
					result: 1_000_000_000n,
				}),
				routeFor({
					abi: STAKING_ABI,
					functionName: "balanceOf",
					address: STAKING_ADDRESS,

					// 200 tokens (18 decimals)
					result: 200_000_000_000_000_000_000n,
				}),
			);
			const { client } = createE2EMockClient(routes);

			const sel = createSEL({
				client,
				schema: buildSchema({
					context: { user: "sol_address" },
					contracts: {
						usdc: { address: TOKEN_ADDRESS, abi: ERC20_ABI },
						staking: { address: STAKING_ADDRESS, abi: STAKING_ABI },
					},
				}),
			});

			// "Does user have >= 500 USDC AND >= 100 staked tokens?"
			const result = await sel.evaluate<boolean>(
				"usdc.balanceOf(user) >= parseUnits(500, 6) && staking.balanceOf(user) >= parseUnits(100, 18)",
				{ user: USER_ADDRESS },
			);
			expect(result.value).toBe(true);
		});

		it("uses parseUnits with context-provided decimals", async () => {
			// User has 1000 USDC = 1_000_000_000 raw
			const routes = buildRoutes(
				routeFor({
					abi: ERC20_ABI,
					functionName: "balanceOf",
					address: TOKEN_ADDRESS,
					result: 1_000_000_000n,
				}),
			);
			const { client } = createE2EMockClient(routes);

			const sel = createSEL({
				client,
				schema: buildSchema({
					context: {
						user: "sol_address",
						minAmount: "sol_int",
						decimals: "sol_int",
					},
					contracts: {
						token: { address: TOKEN_ADDRESS, abi: ERC20_ABI },
					},
				}),
			});

			// Dynamic: threshold and decimals come from context
			const result = await sel.evaluate<boolean>(
				"token.balanceOf(user) >= parseUnits(minAmount, 6)",
				{ user: USER_ADDRESS, minAmount: 500n, decimals: 6n },
			);
			expect(result.value).toBe(true);
		});

		it("returns formatted balance as double from contract call", async () => {
			// User has 1_234_567_890 raw (1234.56789 with 6 decimals)
			const routes = buildRoutes(
				routeFor({
					abi: ERC20_ABI,
					functionName: "balanceOf",
					address: TOKEN_ADDRESS,
					result: 1_234_567_890n,
				}),
			);
			const { client } = createE2EMockClient(routes);

			const sel = createSEL({
				client,
				schema: buildSchema({
					context: { user: "sol_address" },
					contracts: {
						usdc: { address: TOKEN_ADDRESS, abi: ERC20_ABI },
					},
				}),
			});

			const result = await sel.evaluate<number>(
				"formatUnits(usdc.balanceOf(user), 6)",
				{ user: USER_ADDRESS },
			);
			expect(result.value).toBeCloseTo(1234.56789);
		});

		it("builds dashboard map with formatted balances", async () => {
			const WETH_ADDRESS =
				"0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2" as const;
			const routes = buildRoutes(
				routeFor({
					abi: ERC20_ABI,
					functionName: "balanceOf",
					address: TOKEN_ADDRESS,

					// 5000 USDC
					result: 5_000_000_000n,
				}),
				routeFor({
					abi: ERC20_ABI,
					functionName: "balanceOf",
					address: WETH_ADDRESS,

					// 3 WETH
					result: 3_000_000_000_000_000_000n,
				}),
			);
			const { client } = createE2EMockClient(routes);

			const sel = createSEL({
				client,
				schema: buildSchema({
					context: { user: "sol_address" },
					contracts: {
						usdc: { address: TOKEN_ADDRESS, abi: ERC20_ABI },
						weth: { address: WETH_ADDRESS, abi: ERC20_ABI },
					},
				}),
			});

			// Dashboard: check multiple balances against thresholds using parseUnits
			const result = await sel.evaluate<boolean>(
				'usdc.balanceOf(user) >= parseUnits(1000, 6) && weth.balanceOf(user) >= parseUnits("2.5", 18)',
				{ user: USER_ADDRESS },
			);
			expect(result.value).toBe(true);
		});
	});

	describe("min, max, abs, and isZeroAddress", () => {
		it("caps withdrawal at available balance using min", async () => {
			// User has 800 USDC, wants to withdraw 1000 — min caps it
			const routes = buildRoutes(
				routeFor({
					abi: ERC20_ABI,
					functionName: "balanceOf",
					address: TOKEN_ADDRESS,

					// 800 USDC (6 decimals)
					result: 800_000_000n,
				}),
			);
			const { client } = createE2EMockClient(routes);

			const sel = createSEL({
				client,
				schema: buildSchema({
					context: { user: "sol_address" },
					contracts: {
						usdc: { address: TOKEN_ADDRESS, abi: ERC20_ABI },
					},
				}),
			});

			const result = await sel.evaluate<bigint>(
				"min(usdc.balanceOf(user), parseUnits(1000, 6))",
				{ user: USER_ADDRESS },
			);
			expect(result.value).toBe(800_000_000n);
		});

		it("enforces minimum balance using max", async () => {
			// Ensure at least 100 USDC as floor
			const routes = buildRoutes(
				routeFor({
					abi: ERC20_ABI,
					functionName: "balanceOf",
					address: TOKEN_ADDRESS,

					// 50 USDC
					result: 50_000_000n,
				}),
			);
			const { client } = createE2EMockClient(routes);

			const sel = createSEL({
				client,
				schema: buildSchema({
					context: { user: "sol_address" },
					contracts: {
						usdc: { address: TOKEN_ADDRESS, abi: ERC20_ABI },
					},
				}),
			});

			const result = await sel.evaluate<bigint>(
				"max(usdc.balanceOf(user), parseUnits(100, 6))",
				{ user: USER_ADDRESS },
			);
			expect(result.value).toBe(100_000_000n);
		});

		it("uses abs for balance deviation check", async () => {
			const WETH_ADDRESS =
				"0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2" as const;
			const routes = buildRoutes(
				routeFor({
					abi: ERC20_ABI,
					functionName: "balanceOf",
					address: TOKEN_ADDRESS,

					// 900 USDC
					result: 900_000_000n,
				}),
				routeFor({
					abi: ERC20_ABI,
					functionName: "balanceOf",
					address: WETH_ADDRESS,

					// 1100 in same decimals
					result: 1_100_000_000n,
				}),
			);
			const { client } = createE2EMockClient(routes);

			const sel = createSEL({
				client,
				schema: buildSchema({
					context: { user: "sol_address" },
					contracts: {
						tokenA: { address: TOKEN_ADDRESS, abi: ERC20_ABI },
						tokenB: { address: WETH_ADDRESS, abi: ERC20_ABI },
					},
				}),
			});

			// Absolute difference between two balances > 100 USDC
			const result = await sel.evaluate<boolean>(
				"abs(tokenA.balanceOf(user) - tokenB.balanceOf(user)) > parseUnits(100, 6)",
				{ user: USER_ADDRESS },
			);
			expect(result.value).toBe(true);
		});

		it("checks NFT owner is not zero address (not burned)", async () => {
			const NFT_ADDRESS = "0x1111111111111111111111111111111111111111" as const;
			const OWNER_ADDRESS =
				"0xd8da6bf26964af9d7eed9e03e53415d37aa96045" as const;
			const routes = buildRoutes(
				routeFor({
					abi: NFT_ABI,
					functionName: "ownerOf",
					address: NFT_ADDRESS,
					result: OWNER_ADDRESS,
				}),
			);
			const { client } = createE2EMockClient(routes);

			const sel = createSEL({
				client,
				schema: buildSchema({
					contracts: {
						nft: { address: NFT_ADDRESS, abi: NFT_ABI },
					},
				}),
			});

			const result = await sel.evaluate<boolean>(
				"!isZeroAddress(nft.ownerOf(solInt(1)))",
			);
			expect(result.value).toBe(true);
		});

		it("checks burned NFT has zero address owner", async () => {
			const NFT_ADDRESS = "0x1111111111111111111111111111111111111111" as const;
			const routes = buildRoutes(
				routeFor({
					abi: NFT_ABI,
					functionName: "ownerOf",
					address: NFT_ADDRESS,
					result: "0x0000000000000000000000000000000000000000",
				}),
			);
			const { client } = createE2EMockClient(routes);

			const sel = createSEL({
				client,
				schema: buildSchema({
					contracts: {
						nft: { address: NFT_ADDRESS, abi: NFT_ABI },
					},
				}),
			});

			const result = await sel.evaluate<boolean>(
				"isZeroAddress(nft.ownerOf(solInt(42)))",
			);
			expect(result.value).toBe(true);
		});

		it("combines min with parseUnits in access control", async () => {
			const routes = buildRoutes(
				routeFor({
					abi: ERC20_ABI,
					functionName: "balanceOf",
					address: TOKEN_ADDRESS,

					// 5000 USDC
					result: 5_000_000_000n,
				}),
				routeFor({
					abi: STAKING_ABI,
					functionName: "balanceOf",
					address: STAKING_ADDRESS,

					// 300 tokens (18 decimals)
					result: 300_000_000_000_000_000_000n,
				}),
			);
			const { client } = createE2EMockClient(routes);

			const sel = createSEL({
				client,
				schema: buildSchema({
					context: { user: "sol_address" },
					contracts: {
						usdc: { address: TOKEN_ADDRESS, abi: ERC20_ABI },
						staking: { address: STAKING_ADDRESS, abi: STAKING_ABI },
					},
				}),
			});

			// "min of staking balance vs threshold, must be >= 300 tokens"
			const result = await sel.evaluate<boolean>(
				"min(staking.balanceOf(user), parseUnits(500, 18)) >= parseUnits(300, 18)",
				{ user: USER_ADDRESS },
			);
			expect(result.value).toBe(true);
		});
	});
});
