import aaveV3PoolAbi from "./contracts/aave-v3-pool.abi.json" with { type: "json" };
import balancerV2VaultAbi from "./contracts/balancer-v2-vault.abi.json" with { type: "json" };
import chainlinkAggregatorV3Abi from "./contracts/chainlink-aggregator-v3.abi.json" with { type: "json" };
import compoundV3CometAbi from "./contracts/compound-v3-comet.abi.json" with { type: "json" };
import curve3poolAbi from "./contracts/curve-3pool.abi.json" with { type: "json" };
import ensRegistryAbi from "./contracts/ens-registry.abi.json" with { type: "json" };
import erc1155Abi from "./contracts/erc1155.abi.json" with { type: "json" };
import erc20Abi from "./contracts/erc20.abi.json" with { type: "json" };
import erc4626Abi from "./contracts/erc4626.abi.json" with { type: "json" };
import erc721Abi from "./contracts/erc721.abi.json" with { type: "json" };
import gnosisSafeAbi from "./contracts/gnosis-safe.abi.json" with { type: "json" };
import lidoStethAbi from "./contracts/lido-steth.abi.json" with { type: "json" };
import makerdaoVatAbi from "./contracts/makerdao-vat.abi.json" with { type: "json" };
import uniswapV2RouterAbi from "./contracts/uniswap-v2-router.abi.json" with { type: "json" };
import uniswapV3PoolAbi from "./contracts/uniswap-v3-pool.abi.json" with { type: "json" };
import uniswapV3PositionManagerAbi from "./contracts/uniswap-v3-position-manager.abi.json" with { type: "json" };
import vlVestingAbi from "./contracts/vl-vesting.abi.json" with { type: "json" };

import type { ContractFixture } from "./types.js";
import type { Abi } from "abitype";

// Real-world DeFi contracts

export const aaveV3Pool = {
	abi: aaveV3PoolAbi as Abi,
	address: "0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2",
} as const satisfies ContractFixture;

export const balancerV2Vault = {
	abi: balancerV2VaultAbi as Abi,
	address: "0xBA12222222228d8Ba445958a75a0704d566BF2C8",
} as const satisfies ContractFixture;

export const chainlinkAggregatorV3 = {
	abi: chainlinkAggregatorV3Abi as Abi,
	address: "0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419",
} as const satisfies ContractFixture;

export const compoundV3Comet = {
	abi: compoundV3CometAbi as Abi,
	address: "0xc3d688B66703497DAA19211EEdff47f25384cdc3",
} as const satisfies ContractFixture;

export const curve3pool = {
	abi: curve3poolAbi as Abi,
	address: "0xbEbc44782C7dB0a1A60Cb6fe97d0b483032FF1C7",
} as const satisfies ContractFixture;

export const ensRegistry = {
	abi: ensRegistryAbi as Abi,
	address: "0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e",
} as const satisfies ContractFixture;

export const gnosisSafe = {
	abi: gnosisSafeAbi as Abi,
	address: "0xd9Db270c1B5E3Bd161E8c8503c55cEABeE709552",
} as const satisfies ContractFixture;

export const lidoSteth = {
	abi: lidoStethAbi as Abi,
	address: "0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84",
} as const satisfies ContractFixture;

export const makerdaoVat = {
	abi: makerdaoVatAbi as Abi,
	address: "0x35D1b3F3D7966A1DFe207aa4514C12a259A0492B",
} as const satisfies ContractFixture;

export const uniswapV2Router = {
	abi: uniswapV2RouterAbi as Abi,
	address: "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D",
} as const satisfies ContractFixture;

export const uniswapV3Pool = {
	abi: uniswapV3PoolAbi as Abi,
	address: "0x88e6A0c2dDD26FEEb64F039a2c41296FcB3f5640",
} as const satisfies ContractFixture;

export const uniswapV3PositionManager = {
	abi: uniswapV3PositionManagerAbi as Abi,
	address: "0xC36442b4a4522E871399CD717aBDD847Ab11FE88",
} as const satisfies ContractFixture;

export const vlVesting = {
	abi: vlVestingAbi as Abi,
	address: "0xc3a87764271f3e94ab8f5e5a3a56b1bc60b87a21",
} as const satisfies ContractFixture;

// Standard token interfaces (no specific address)

export const erc20 = {
	abi: erc20Abi as Abi,
} as const satisfies ContractFixture;

export const erc721 = {
	abi: erc721Abi as Abi,
} as const satisfies ContractFixture;

export const erc1155 = {
	abi: erc1155Abi as Abi,
} as const satisfies ContractFixture;

export const erc4626 = {
	abi: erc4626Abi as Abi,
} as const satisfies ContractFixture;
