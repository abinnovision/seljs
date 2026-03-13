import { type Abi, decodeFunctionResult, encodeFunctionData } from "viem";
import { describe, expect, it } from "vitest";

import { aaveV3Pool, compoundV3Comet } from "./contracts.js";
import { createE2EMockClient } from "./mock-client.js";
import { buildRoutes, routeFor } from "./routes.js";

/**
 * Custom assertion to ensure that the response has a `data` field of type `0x${string}`.
 */
function assertData(response: {
	data?: `0x${string}`;
}): asserts response is { data: `0x${string}` } {
	if (!response.data) {
		throw new Error("Expected data in response");
	}
}

describe("src/mock/mock-client.ts", () => {
	it("returns a simple uint256 value", async () => {
		const utilization = 800000000000000000n;
		const routes = buildRoutes(
			routeFor({
				abi: compoundV3Comet.abi,
				functionName: "getUtilization",
				address: compoundV3Comet.address,
				result: utilization,
			}),
		);

		const { client } = createE2EMockClient(routes);
		const callData = encodeFunctionData({
			abi: compoundV3Comet.abi,
			functionName: "getUtilization",
		});

		const response = await client.call({
			to: compoundV3Comet.address,
			data: callData,
		});

		assertData(response);

		const decoded = decodeFunctionResult({
			abi: compoundV3Comet.abi,
			functionName: "getUtilization",
			data: response.data,
		});

		expect(decoded).toBe(utilization);
	});

	it("returns a full struct (AssetInfo) with 8 fields", async () => {
		const assetInfo = {
			offset: 0,
			asset: "0x0000000000000000000000000000000000000001",
			priceFeed: "0x0000000000000000000000000000000000000002",
			scale: 1000000n,
			borrowCollateralFactor: 900000000000000000n,
			liquidateCollateralFactor: 930000000000000000n,
			liquidationFactor: 950000000000000000n,
			supplyCap: 100000000000n,
		};

		const routes = buildRoutes(
			routeFor({
				abi: compoundV3Comet.abi as unknown as Abi,
				functionName: "getAssetInfo",
				address: compoundV3Comet.address,
				result: assetInfo,
			}),
		);

		const { client } = createE2EMockClient(routes);
		const callData = encodeFunctionData({
			abi: compoundV3Comet.abi,
			functionName: "getAssetInfo",
			args: [0],
		});

		const response = await client.call({
			to: compoundV3Comet.address,
			data: callData,
		});
		assertData(response);

		const decoded = decodeFunctionResult({
			abi: compoundV3Comet.abi,
			functionName: "getAssetInfo",
			data: response.data,
		}) as Record<string, unknown>;

		expect(decoded["offset"]).toBe(assetInfo.offset);
		expect((decoded["asset"] as string).toLowerCase()).toBe(
			assetInfo.asset.toLowerCase(),
		);
		expect((decoded["priceFeed"] as string).toLowerCase()).toBe(
			assetInfo.priceFeed.toLowerCase(),
		);
		expect(decoded["scale"]).toBe(assetInfo.scale);
		expect(decoded["borrowCollateralFactor"]).toBe(
			assetInfo.borrowCollateralFactor,
		);
		expect(decoded["liquidateCollateralFactor"]).toBe(
			assetInfo.liquidateCollateralFactor,
		);
		expect(decoded["liquidationFactor"]).toBe(assetInfo.liquidationFactor);
		expect(decoded["supplyCap"]).toBe(assetInfo.supplyCap);
	});

	it("returns a dynamic address[] array", async () => {
		const reserves = [
			"0x0000000000000000000000000000000000000001",
			"0x0000000000000000000000000000000000000002",
			"0x0000000000000000000000000000000000000003",
		] as const;

		const routes = buildRoutes(
			routeFor({
				abi: aaveV3Pool.abi as unknown as Abi,
				functionName: "getReservesList",
				address: aaveV3Pool.address,
				result: reserves,
			}),
		);

		const { client } = createE2EMockClient(routes);
		const callData = encodeFunctionData({
			abi: aaveV3Pool.abi,
			functionName: "getReservesList",
		});

		const response = await client.call({
			to: aaveV3Pool.address,
			data: callData,
		});
		assertData(response);

		const decoded = decodeFunctionResult({
			abi: aaveV3Pool.abi,
			functionName: "getReservesList",
			data: response.data,
		}) as readonly string[];

		expect(decoded.length).toBe(3);
		expect(decoded[0]?.toLowerCase()).toBe(reserves[0].toLowerCase());
		expect(decoded[1]?.toLowerCase()).toBe(reserves[1].toLowerCase());
		expect(decoded[2]?.toLowerCase()).toBe(reserves[2].toLowerCase());
	});

	it("returns argument-dependent values via function result", async () => {
		const routes = buildRoutes(
			routeFor({
				abi: compoundV3Comet.abi as unknown as Abi,
				functionName: "getSupplyRate",
				address: compoundV3Comet.address,
				result: (args: readonly unknown[]) => {
					const utilization = args[0] as bigint;
					if (utilization === 800000000000000000n) {
						return 50000n;
					}

					if (utilization === 0n) {
						return 0n;
					}

					return 0n;
				},
			}),
		);

		const { client } = createE2EMockClient(routes);

		// Call with 80% utilization
		const callData80 = encodeFunctionData({
			abi: compoundV3Comet.abi,
			functionName: "getSupplyRate",
			args: [800000000000000000n],
		});
		const response80 = await client.call({
			to: compoundV3Comet.address,
			data: callData80,
		});
		assertData(response80);
		const decoded80 = decodeFunctionResult({
			abi: compoundV3Comet.abi,
			functionName: "getSupplyRate",
			data: response80.data,
		});
		expect(decoded80).toBe(50000n);

		// Call with 0 utilization
		const callData0 = encodeFunctionData({
			abi: compoundV3Comet.abi,
			functionName: "getSupplyRate",
			args: [0n],
		});
		const response0 = await client.call({
			to: compoundV3Comet.address,
			data: callData0,
		});
		assertData(response0);
		const decoded0 = decodeFunctionResult({
			abi: compoundV3Comet.abi,
			functionName: "getSupplyRate",
			data: response0.data,
		});
		expect(decoded0).toBe(0n);
	});

	it("tracks calls in callLog and counts RPC calls", async () => {
		const routes = buildRoutes(
			routeFor({
				abi: compoundV3Comet.abi as unknown as Abi,
				functionName: "getUtilization",
				address: compoundV3Comet.address,
				result: 42n,
			}),
		);

		const { client, callLog, getRpcCallCount } = createE2EMockClient(routes);

		const callData = encodeFunctionData({
			abi: compoundV3Comet.abi,
			functionName: "getUtilization",
		});

		await client.call({ to: compoundV3Comet.address, data: callData });
		await client.call({ to: compoundV3Comet.address, data: callData });

		expect(getRpcCallCount()).toBe(2);
		expect(callLog).toHaveLength(2);
		expect(callLog[0]?.to).toBe(compoundV3Comet.address.toLowerCase());
	});

	it("throws when a route is not found", async () => {
		// empty routes
		const routes = buildRoutes();

		const { client } = createE2EMockClient(routes);
		const callData = encodeFunctionData({
			abi: compoundV3Comet.abi,
			functionName: "getUtilization",
		});

		await expect(
			client.call({ to: compoundV3Comet.address, data: callData }),
		).rejects.toThrow(/No mock route/);
	});
});
