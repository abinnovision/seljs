import { toFunctionSelector } from "viem";

import type { MockRoute, RouteMap } from "./mock-client.js";
import type { Abi, AbiFunction, Address } from "viem";

interface RouteForParams {
	abi: Abi;
	functionName: string;
	address: Address;
	result: MockRoute["result"];
}

/**
 * Create a route entry for a specific function.
 */
export const routeFor = (params: RouteForParams): [string, MockRoute] => {
	const { abi, functionName, address, result } = params;
	const fn = (abi as AbiFunction[]).find((item) => item.name === functionName);
	if (!fn) {
		throw new Error(`Function "${functionName}" not found in ABI`);
	}

	const selector = toFunctionSelector(fn);
	const key = `${address.toLowerCase()}:${selector}`;

	return [key, { abi, functionName, result }];
};

/**
 * Build a RouteMap from multiple route entries
 */
export const buildRoutes = (...entries: [string, MockRoute][]): RouteMap =>
	new Map(entries);
