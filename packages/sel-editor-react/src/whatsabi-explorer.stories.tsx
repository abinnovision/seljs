import { buildSchema } from "@seljs/env";
import { createSEL } from "@seljs/runtime";
import { whatsabi } from "@shazow/whatsabi";
import { useState } from "react";
import { createPublicClient, http } from "viem";
import { mainnet, arbitrum, optimism, base, polygon, bsc } from "viem/chains";

import { SELEditor } from "./sel-editor";

import type { SELSchema } from "@seljs/schema";
import type { Meta } from "@storybook/react";
import type { Abi, PublicClient } from "viem";

const CHAINS = {
	ethereum: { chain: mainnet, label: "Ethereum" },
	arbitrum: { chain: arbitrum, label: "Arbitrum" },
	optimism: { chain: optimism, label: "Optimism" },
	base: { chain: base, label: "Base" },
	polygon: { chain: polygon, label: "Polygon" },
	bsc: { chain: bsc, label: "BSC" },
} as const;

type ChainKey = keyof typeof CHAINS;

async function fetchAbiAndBuildSchema(
	address: string,
	chainKey: ChainKey,
	contractName: string,
): Promise<{
	schema: SELSchema;
	proxyAddress: string | null;
	client: PublicClient;
	abi: Abi;
	address: string;
}> {
	const { chain } = CHAINS[chainKey];
	const client = createPublicClient({
		chain,
		transport: http(`http://localhost:4000/main/evm/${String(chain.id)}`),
	});

	const result = await whatsabi.autoload(address, {
		provider: client,
		followProxies: true,
		abiLoader: new whatsabi.loaders.MultiABILoader([
			new whatsabi.loaders.SourcifyABILoader({
				chainId: chain.id,
			}),
			new whatsabi.loaders.EtherscanABILoader({
				chainId: chain.id,
				apiKey: "JXDYVQ1SJXRDJWWJPEUSK3ARU3KHJ1W8Z8",
			}),
		]),
	});

	const proxyAddress =
		result.address.toLowerCase() !== address.toLowerCase()
			? result.address
			: null;

	const schema = buildSchema({
		contracts: {
			[contractName]: {
				address: address as `0x${string}`,
				abi: result.abi as Abi,
			},
		},
	});

	return {
		schema,
		proxyAddress,
		client: client as PublicClient,
		abi: result.abi as Abi,
		address,
	};
}

function countMethods(schema: SELSchema): number {
	return schema.contracts.reduce((acc, c) => acc + c.methods.length, 0);
}

function formatResult(value: unknown): string {
	if (typeof value === "bigint") {
		return `${value.toString()}n`;
	}

	if (typeof value === "object" && value !== null) {
		return JSON.stringify(
			value,
			(_key, v: unknown) => (typeof v === "bigint" ? `${v.toString()}n` : v),
			2,
		);
	}

	return String(value);
}

interface WhatsAbiExplorerProps {
	initialAddress?: string;
	initialName?: string;
	initialExpression?: string;
}

function WhatsAbiExplorer({
	initialAddress = "",
	initialName = "contract",
	initialExpression = "",
}: WhatsAbiExplorerProps) {
	const [chainKey, setChainKey] = useState<ChainKey>("ethereum");
	const [address, setAddress] = useState(initialAddress);
	const [contractName, setContractName] = useState(initialName);
	const [status, setStatus] = useState<
		| { kind: "idle" }
		| { kind: "loading" }
		| {
				kind: "success";
				schema: SELSchema;
				proxyAddress: string | null;
				client: PublicClient;
				abi: Abi;
				address: string;
		  }
		| { kind: "error"; message: string }
	>({ kind: "idle" });
	const [expression, setExpression] = useState<string>(initialExpression);
	const [execState, setExecState] = useState<
		| { kind: "idle" }
		| { kind: "running" }
		| { kind: "result"; value: string; type: string }
		| { kind: "error"; message: string }
	>({ kind: "idle" });

	const handleFetch = async () => {
		if (!address.trim()) {
			return;
		}

		setStatus({ kind: "loading" });
		try {
			const {
				schema,
				proxyAddress,
				client,
				abi,
				address: resolvedAddress,
			} = await fetchAbiAndBuildSchema(
				address.trim(),
				chainKey,
				contractName.trim() || "contract",
			);
			setStatus({
				kind: "success",
				schema,
				proxyAddress,
				client,
				abi,
				address: resolvedAddress,
			});
			setExecState({ kind: "idle" });
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			setStatus({ kind: "error", message });
		}
	};

	const handleRun = async () => {
		if (status.kind !== "success" || !expression.trim()) {
			return;
		}

		setExecState({ kind: "running" });
		try {
			const sel = createSEL({
				client: status.client,
				schema: buildSchema({
					contracts: {
						[contractName.trim() || "contract"]: {
							abi: status.abi,
							address: status.address as `0x${string}`,
						},
					},
				}),
			});
			const result = await sel.evaluate(expression);
			const value = result.value;
			const formatted = formatResult(value);
			setExecState({ kind: "result", value: formatted, type: typeof value });
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			const cause =
				err instanceof Error && err.cause instanceof Error
					? err.cause.message
					: undefined;
			setExecState({
				kind: "error",
				message: cause ? `${message}\n\nCause: ${cause}` : message,
			});
		}
	};

	const isLoading = status.kind === "loading";
	const canFetch = !isLoading && address.trim().length > 0;
	const canRun =
		status.kind === "success" &&
		expression.trim().length > 0 &&
		execState.kind !== "running";

	return (
		<div style={{ fontFamily: "system-ui, sans-serif" }}>
			<div
				style={{
					display: "flex",
					flexDirection: "column",
					gap: 12,
					marginBottom: 16,
				}}
			>
				<div style={{ display: "flex", gap: 8 }}>
					<select
						value={chainKey}
						onChange={(e) => {
							setChainKey(e.target.value as ChainKey);
						}}
						style={{
							padding: "8px 12px",
							borderRadius: 6,
							border: "1px solid #d1d5db",
							background: "#fff",
							fontSize: 14,
							cursor: "pointer",
						}}
					>
						{(Object.keys(CHAINS) as ChainKey[]).map((key) => (
							<option key={key} value={key}>
								{CHAINS[key].label}
							</option>
						))}
					</select>

					<input
						type="text"
						value={address}
						onChange={(e) => {
							setAddress(e.target.value);
						}}
						placeholder="0x..."
						style={{
							flex: 1,
							padding: "8px 12px",
							borderRadius: 6,
							border: "1px solid #d1d5db",
							fontFamily: "monospace",
							fontSize: 14,
						}}
					/>

					<input
						type="text"
						value={contractName}
						onChange={(e) => {
							setContractName(e.target.value);
						}}
						placeholder="contract name"
						style={{
							width: 140,
							padding: "8px 12px",
							borderRadius: 6,
							border: "1px solid #d1d5db",
							fontSize: 14,
						}}
					/>

					<button
						onClick={() => void handleFetch()}
						disabled={!canFetch}
						style={{
							padding: "8px 18px",
							borderRadius: 6,
							border: "none",
							background: canFetch ? "#2563eb" : "#93c5fd",
							color: "#fff",
							fontSize: 14,
							fontWeight: 600,
							cursor: canFetch ? "pointer" : "not-allowed",
							whiteSpace: "nowrap",
						}}
					>
						{isLoading ? "Loading..." : "Fetch ABI"}
					</button>
				</div>

				{status.kind === "error" && (
					<div
						style={{
							padding: "10px 14px",
							borderRadius: 6,
							background: "#fee2e2",
							color: "#b91c1c",
							fontSize: 14,
						}}
					>
						{status.message}
					</div>
				)}

				{status.kind === "success" && status.proxyAddress && (
					<div
						style={{
							padding: "10px 14px",
							borderRadius: 6,
							background: "#dbeafe",
							color: "#1e40af",
							fontSize: 14,
						}}
					>
						Proxy detected — implementation at{" "}
						<span style={{ fontFamily: "monospace" }}>
							{status.proxyAddress}
						</span>
					</div>
				)}

				{status.kind === "success" && (
					<div style={{ fontSize: 13, color: "#6b7280" }}>
						{countMethods(status.schema)} view/pure method(s) found
					</div>
				)}
			</div>

			{status.kind === "success" && (
				<>
					<SELEditor
						schema={status.schema}
						value={expression}
						placeholder={`Try ${contractName.trim() || "contract"}.<method>(...)`}
						onChange={(value) => {
							setExpression(value);
						}}
						features={{ typeDisplay: true }}
					/>

					<div style={{ marginTop: 12 }}>
						<button
							onClick={() => void handleRun()}
							disabled={!canRun}
							style={{
								padding: "8px 18px",
								borderRadius: 6,
								border: "none",
								background: canRun ? "#16a34a" : "#86efac",
								color: "#fff",
								fontSize: 14,
								fontWeight: 600,
								cursor: canRun ? "pointer" : "not-allowed",
								whiteSpace: "nowrap",
							}}
						>
							{execState.kind === "running" ? "Running..." : "Run"}
						</button>

						{execState.kind === "running" && (
							<div style={{ marginTop: 10, fontSize: 14, color: "#6b7280" }}>
								Executing...
							</div>
						)}

						{execState.kind === "result" && (
							<pre
								style={{
									marginTop: 10,
									padding: "10px 14px",
									borderRadius: 6,
									background: "#f3f4f6",
									fontFamily: "monospace",
									fontSize: 14,
									overflowX: "auto",
								}}
							>
								{execState.value}
							</pre>
						)}

						{execState.kind === "error" && (
							<div
								style={{
									marginTop: 10,
									padding: "10px 14px",
									borderRadius: 6,
									background: "#fee2e2",
									color: "#b91c1c",
									fontSize: 14,
								}}
							>
								{execState.message}
							</div>
						)}
					</div>
				</>
			)}
		</div>
	);
}

const meta: Meta = {
	title: "WhatsABI Explorer",
	parameters: {
		layout: "padded",
	},
	decorators: [
		(Story) => (
			<div style={{ maxWidth: 700, margin: "0 auto" }}>
				<Story />
			</div>
		),
	],
};

export default meta;

export const Default = {
	render: () => <WhatsAbiExplorer />,
};

export const WithPrefilledAddress = {
	render: () => (
		<WhatsAbiExplorer
			initialAddress="0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"
			initialName="usdc"
		/>
	),
};

export const AavePool = {
	name: "Aave V3 Pool",
	render: () => (
		<WhatsAbiExplorer
			initialAddress="0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2"
			initialName="contract"
			initialExpression='contract.getReserveData(solAddress("0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2"))'
		/>
	),
};
