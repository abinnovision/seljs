/**
 * EVM fixed-point and scale constants exposed as top-level `sol_int` identifiers
 * in SEL expressions. Shared between the runtime (for `registerConstant`) and
 * the schema (for editor autocomplete).
 */
export interface EvmConstantDefinition {
	name: string;
	value: bigint;
	description: string;
}

export const EVM_CONSTANTS: readonly EvmConstantDefinition[] = [
	{
		name: "WAD",
		value: 10n ** 18n,
		description: "10^18 — scale factor for 18-decimal tokens (ETH, DAI, etc.)",
	},
	{
		name: "RAY",
		value: 10n ** 27n,
		description:
			"10^27 — 27-decimal fixed-point scale used by Aave and MakerDAO",
	},
	{
		name: "Q96",
		value: 1n << 96n,
		description:
			"2^96 — divisor for Uniswap v3 sqrtPriceX96 fixed-point values",
	},
	{
		name: "Q128",
		value: 1n << 128n,
		description: "2^128 — divisor for Q128 fixed-point values",
	},
	{
		name: "MAX_UINT256",
		value: 2n ** 256n - 1n,
		description:
			"2^256 - 1 — uint256 ceiling, commonly used as an unlimited approval",
	},
];
