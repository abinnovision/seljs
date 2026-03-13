/**
 * Cache for storing contract call results during expression evaluation.
 *
 * Uses Map-based storage with deterministic call IDs for efficient
 * lookup and deduplication of repeated contract calls.
 */
export class ResultCache {
	private readonly cache = new Map<string, unknown>();

	/**
	 * Generate a deterministic call ID from contract details.
	 *
	 * The ID format is `contract:method:serializedArgs` where args are
	 * JSON-stringified with special handling for bigint values.
	 *
	 * @param contract - Contract name (e.g., "token", "vault")
	 * @param method - Method name (e.g., "balanceOf", "totalSupply")
	 * @param args - Method arguments
	 * @returns Deterministic call ID string
	 */
	public generateCallId(
		contract: string,
		method: string,
		args: unknown[],
	): string {
		const argKey = JSON.stringify(args, (_: string, v: unknown) => {
			if (typeof v === "bigint") {
				return `${String(v)}n`;
			}

			if (typeof v === "object" && v !== null && !Array.isArray(v)) {
				return Object.fromEntries(
					Object.entries(v as Record<string, unknown>).sort(([a], [b]) =>
						a.localeCompare(b),
					),
				);
			}

			return v;
		});

		return `${contract}:${method}:${argKey}`;
	}

	/**
	 * Store a result in the cache.
	 *
	 * @param callId - The call ID (from generateCallId)
	 * @param result - The result to cache
	 */
	public set(callId: string, result: unknown): void {
		this.cache.set(callId, result);
	}

	/**
	 * Retrieve a cached result.
	 *
	 * @param callId - The call ID to look up
	 * @returns The cached result, or undefined if not found
	 */
	public get(callId: string): unknown {
		return this.cache.get(callId);
	}

	/**
	 * Check if a result is cached.
	 *
	 * @param callId - The call ID to check
	 * @returns true if cached, false otherwise
	 */
	public has(callId: string): boolean {
		return this.cache.has(callId);
	}

	/**
	 * Clear all cached results.
	 */
	public clear(): void {
		this.cache.clear();
	}
}
