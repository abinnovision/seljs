import { AbiFunction } from "ox";

const aggregate3Abi = {
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
} as const;

export const MULTICALL3_ADDRESS: `0x${string}` =
	"0xcA11bde05977b3631167028862bE2a173976CA11";

/**
 * Pre-parsed Multicall3 aggregate3 ABI function for ox encoding/decoding.
 */
export const multicall3Function = AbiFunction.from(aggregate3Abi);

export interface MulticallCall {
	target: `0x${string}`;
	allowFailure: boolean;
	callData: `0x${string}`;
}

export interface MulticallResult {
	success: boolean;
	returnData: `0x${string}`;
}
