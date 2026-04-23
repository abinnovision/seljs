/**
 * Fields exposed on the `sel` namespace in SEL expressions. Each entry
 * is surfaced at runtime via a struct-typed constant, and in the schema
 * as a field on `SelNamespace` so editor autocomplete picks it up.
 */
export type EvmConstantDefinition =
	| {
			name: string;
			type: "sol_int";
			value: bigint;
			description: string;
	  }
	| {
			name: string;
			type: "sol_address";
			value: `0x${string}`;
			description: string;
	  };

export const EVM_CONSTANTS: readonly EvmConstantDefinition[] = [
	{
		name: "WAD",
		type: "sol_int",
		value: 10n ** 18n,
		description: "10^18 — scale factor for 18-decimal tokens (ETH, DAI, etc.)",
	},
	{
		name: "RAY",
		type: "sol_int",
		value: 10n ** 27n,
		description:
			"10^27 — 27-decimal fixed-point scale used by Aave and MakerDAO",
	},
	{
		name: "Q96",
		type: "sol_int",
		value: 1n << 96n,
		description:
			"2^96 — divisor for Uniswap v3 sqrtPriceX96 fixed-point values",
	},
	{
		name: "Q128",
		type: "sol_int",
		value: 1n << 128n,
		description: "2^128 — divisor for Q128 fixed-point values",
	},
	{
		name: "MAX_UINT256",
		type: "sol_int",
		value: 2n ** 256n - 1n,
		description:
			"2^256 - 1 — uint256 ceiling, commonly used as an unlimited approval",
	},
	{
		name: "ZERO_ADDRESS",
		type: "sol_address",
		value: "0x0000000000000000000000000000000000000000",
		description:
			"The zero address (0x0…0) — burn destination and uninitialized-slot sentinel",
	},
];
