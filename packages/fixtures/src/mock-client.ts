import {
	type Abi,
	type Address,
	type PublicClient,
	decodeFunctionData,
	encodeAbiParameters,
	encodeFunctionResult,
} from "viem";

const MULTICALL3_ADDRESS = "0xcA11bde05977b3631167028862bE2a173976CA11";

const multicall3Abi = [
	{
		name: "aggregate3",
		type: "function",
		stateMutability: "payable",
		inputs: [
			{
				name: "calls",
				type: "tuple[]",
				components: [
					{ name: "target", type: "address" },
					{ name: "allowFailure", type: "bool" },
					{ name: "callData", type: "bytes" },
				],
			},
		],
		outputs: [
			{
				name: "returnData",
				type: "tuple[]",
				components: [
					{ name: "success", type: "bool" },
					{ name: "returnData", type: "bytes" },
				],
			},
		],
	},
] as const;

const routeCall = (
	routes: RouteMap,
	target: string,
	callData: `0x${string}`,
): `0x${string}` => {
	const selector = callData.slice(0, 10);
	const key = `${target.toLowerCase()}:${selector}`;
	const route = routes.get(key);

	if (!route) {
		throw new Error(
			`No mock route for target=${target} selector=${selector} (key=${key})`,
		);
	}

	let value: unknown;
	if (typeof route.result === "function") {
		const decoded = decodeFunctionData({
			abi: route.abi,
			data: callData,
		});

		value = (route.result as (decodedArgs: readonly unknown[]) => unknown)(
			decoded.args ?? [],
		);
	} else {
		value = route.result;
	}

	return encodeFunctionResult({
		abi: route.abi,
		functionName: route.functionName,
		result: value as never,
	});
};

const encodeAggregate3Response = (
	results: Array<{ success: boolean; returnData: `0x${string}` }>,
): `0x${string}` =>
	encodeAbiParameters(
		multicall3Abi[0].outputs as readonly [
			{
				readonly name: string;
				readonly type: "tuple[]";
				readonly components: readonly [
					{ readonly name: string; readonly type: "bool" },
					{ readonly name: string; readonly type: "bytes" },
				];
			},
		],
		[results],
	);

interface E2EMockClient {
	client: PublicClient;
	callLog: Array<{ to: string; selector: string; callData: `0x${string}` }>;
	getRpcCallCount: () => number;
}

export interface MockRoute {
	abi: Abi;
	functionName: string;

	/**
	 * Static value OR a function that receives decoded arguments and returns the value
	 */
	result: unknown;
}

/**
 * Key format: "{lowercaseAddress}:{4-byte selector}"
 */
export type RouteMap = Map<string, MockRoute>;

export const createE2EMockClient = (routes: RouteMap): E2EMockClient => {
	const callLog: Array<{
		to: string;
		selector: string;
		callData: `0x${string}`;
	}> = [];

	let rpcCallCount = 0;

	const client = {
		getBlockNumber: () => Promise.resolve(100n),
		call: (params: { to: Address; data: `0x${string}` }) => {
			rpcCallCount++;
			const { to, data } = params;

			if (to.toLowerCase() === MULTICALL3_ADDRESS.toLowerCase()) {
				const { args } = decodeFunctionData({
					abi: multicall3Abi,
					data,
				});
				const calls = args[0] as Array<{
					target: string;
					allowFailure: boolean;
					callData: `0x${string}`;
				}>;

				const results = calls.map(({ target, callData }) => {
					const selector = callData.slice(0, 10);
					callLog.push({
						to: target.toLowerCase(),
						selector,
						callData,
					});
					const returnData = routeCall(routes, target, callData);

					return { success: true, returnData };
				});

				return Promise.resolve({ data: encodeAggregate3Response(results) });
			}

			// Direct (non-multicall) call
			const selector = data.slice(0, 10);
			callLog.push({ to: to.toLowerCase(), selector, callData: data });
			try {
				const returnData = routeCall(routes, to, data);

				return Promise.resolve({ data: returnData });
			} catch (err) {
				return Promise.reject(
					err instanceof Error ? err : new Error(String(err)),
				);
			}
		},
	};

	return {
		client: client as unknown as PublicClient,
		callLog,
		getRpcCallCount: () => rpcCallCount,
	};
};
