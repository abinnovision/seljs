import { SELClientError } from "../errors/index.js";

/**
 * Minimal client interface for SEL runtime contract execution.
 *
 * Framework-agnostic: works with viem PublicClient, ethers.js Provider,
 * web3.js, or any object that can make eth_call and eth_blockNumber requests.
 *
 * A viem PublicClient structurally satisfies this interface.
 */
export interface SELClient {
	/**
	 * Execute an eth_call against a contract
	 */
	call: (params: {
		to: `0x${string}`;
		data: `0x${string}`;
		blockNumber?: bigint;
	}) => Promise<{ data?: `0x${string}` | undefined }>;

	/**
	 *  Get the current block number (eth_blockNumber) for pinning reads
	 */
	getBlockNumber: () => Promise<bigint>;
}

/**
 * Validates that an object satisfies the SELClient interface.
 * Throws SELClientError if validation fails.
 * Called at construction time for fail-fast behavior.
 */
export function validateClient(client: unknown): asserts client is SELClient {
	if (!client || typeof client !== "object") {
		throw new SELClientError("Client must be an object");
	}

	const c = client as Record<string, unknown>;

	if (typeof c["call"] !== "function") {
		throw new SELClientError(
			"Client must implement call({ to, data, blockNumber? }). ",
		);
	}

	if (typeof c["getBlockNumber"] !== "function") {
		throw new SELClientError("Client must implement getBlockNumber(). ");
	}
}
