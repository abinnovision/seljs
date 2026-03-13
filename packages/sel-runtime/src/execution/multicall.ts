import type { Address, Hex } from "viem";

export const MULTICALL3_ADDRESS: Address =
	"0xcA11bde05977b3631167028862bE2a173976CA11";

export const multicall3Abi = [
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

export interface MulticallCall {
	target: Address;
	allowFailure: boolean;
	callData: Hex;
}

export interface MulticallResult {
	success: boolean;
	returnData: Hex;
}
