import type { ContractFixture } from "./types.js";

export const syntheticStructEdgeCases = {
	abi: [
		{
			type: "function",
			name: "getNestedDeep",
			stateMutability: "view",
			inputs: [],
			outputs: [
				{
					name: "",
					type: "tuple",
					components: [
						{ name: "id", type: "uint256" },
						{
							name: "inner",
							type: "tuple",
							components: [
								{ name: "token", type: "address" },
								{
									name: "config",
									type: "tuple",
									components: [
										{ name: "rate", type: "uint128" },
										{ name: "active", type: "bool" },
									],
								},
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
						{ name: "debt", type: "int256" },
					],
				},
			],
		},
		{
			type: "function",
			name: "getAccount",
			stateMutability: "view",
			inputs: [{ name: "user", type: "address" }],
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
						{ name: "nonce", type: "uint256" },
					],
				},
			],
		},
		{
			type: "function",
			name: "getMultiReturn",
			stateMutability: "view",
			inputs: [],
			outputs: [
				{ name: "reserve0", type: "uint112" },
				{ name: "reserve1", type: "uint112" },
				{ name: "blockTimestampLast", type: "uint32" },
			],
		},
	],
} as const satisfies ContractFixture;

export const syntheticTypeEdgeCases = {
	abi: [
		{
			type: "function",
			name: "lookup",
			stateMutability: "view",
			inputs: [{ name: "", type: "bytes32" }],
			outputs: [{ name: "", type: "uint256" }],
		},
		{
			type: "function",
			name: "lookup",
			stateMutability: "view",
			inputs: [{ name: "", type: "address" }],
			outputs: [{ name: "", type: "uint256" }],
		},
		{
			type: "function",
			name: "lookup",
			stateMutability: "view",
			inputs: [
				{ name: "", type: "bytes32" },
				{ name: "", type: "address" },
			],
			outputs: [
				{ name: "", type: "uint256" },
				{ name: "", type: "uint256" },
			],
		},
		{
			type: "function",
			name: "getExoticWidths",
			stateMutability: "view",
			inputs: [{ name: "tick", type: "int24" }],
			outputs: [
				{ name: "price", type: "uint160" },
				{ name: "delta", type: "int56" },
				{ name: "flags", type: "uint8" },
			],
		},
		{
			type: "function",
			name: "getAddresses",
			stateMutability: "view",
			inputs: [],
			outputs: [{ name: "", type: "address[]" }],
		},
		{
			type: "function",
			name: "getAmounts",
			stateMutability: "view",
			inputs: [],
			outputs: [{ name: "", type: "uint256[]" }],
		},
		{
			type: "function",
			name: "isActive",
			stateMutability: "view",
			inputs: [{ name: "id", type: "uint256" }],
			outputs: [{ name: "", type: "bool" }],
		},
		{
			type: "function",
			name: "getName",
			stateMutability: "view",
			inputs: [],
			outputs: [{ name: "", type: "string" }],
		},
	],
} as const satisfies ContractFixture;
