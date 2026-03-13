/**
 * Abstract base registry providing a generic Map-based store
 * with lookup by name.
 *
 * Subclasses implement `register()` to handle domain-specific
 * validation and transformation before storing entries.
 *
 * @typeParam TConfig - The input configuration type for registration
 * @typeParam TEntry - The stored entry type (what gets retrieved)
 */
// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters
export abstract class Registry<TConfig, TEntry> {
	protected readonly entries = new Map<string, TEntry>();

	/**
	 * Register an entry with domain-specific validation/transformation.
	 *
	 * @param name - Unique identifier for the entry
	 * @param config - Configuration to transform into a stored entry
	 * @returns this for method chaining
	 */
	public abstract register(name: string, config: TConfig): this;

	/**
	 * Get a registered entry by name.
	 *
	 * @param name - The entry identifier
	 * @returns The stored entry, or undefined if not found
	 */
	public get(name: string): TEntry | undefined {
		return this.entries.get(name);
	}

	/**
	 * Get all registered entries.
	 *
	 * @returns Array of all stored entries
	 */
	public getAll(): TEntry[] {
		return Array.from(this.entries.values());
	}

	/**
	 * Check whether an entry with the given name exists.
	 *
	 * @param name - The entry identifier
	 */
	public has(name: string): boolean {
		return this.entries.has(name);
	}
}
