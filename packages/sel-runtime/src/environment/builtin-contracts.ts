import {
	MULTICALL3_ADDRESS,
	getEthBalanceAbi,
} from "../execution/multicall.js";

import type { MulticallOptions } from "./types.js";
import type { ContractSchema } from "@seljs/schema";

/**
 * Returns built-in contract schemas that are always available in the runtime.
 * These are internal contracts not defined by the user schema but required
 * for built-in features like address accessors.
 */
export const getBuiltinContracts = (
	multicall?: MulticallOptions,
): ContractSchema[] => [
	{
		name: "__multicall3",
		address: multicall?.address ?? MULTICALL3_ADDRESS,
		methods: [
			{
				name: "getEthBalance",
				params: [{ name: "addr", type: "sol_address" }],
				returns: "sol_int",
				abi: getEthBalanceAbi,
			},
		],
	},
];
