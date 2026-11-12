import type { AbiFunction } from "abitype";

/**
 * A contract method referenced by an expression.
 */
export interface FootprintMethod {
	/**
	 * Method name as written in the expression.
	 */
	name: string;

	/**
	 * 4-byte function selector of the resolved ABI entry.
	 */
	selector: `0x${string}`;

	/**
	 * Canonical signature, e.g. "balanceOf(address)".
	 */
	signature: string;

	/**
	 * Exact ABI fragment of the resolved overload.
	 */
	abi: AbiFunction;
}

/**
 * A user contract referenced by an expression.
 */
export interface ContractFootprint {
	/**
	 * Contract alias used in the expression, e.g. "usdc".
	 */
	name: string;

	/**
	 * Contract address from the schema.
	 */
	address: `0x${string}`;

	/**
	 * Referenced methods, sorted by signature and deduplicated by selector.
	 * Empty when the contract is only referenced through its `.address`.
	 *
	 * Each entry is the overload the checker resolved. When an argument has a
	 * dyn type, every same-name, same-arity overload is listed, since the
	 * overload is only chosen at evaluation time. The runtime currently
	 * dispatches by method name only, so for overloaded methods the called
	 * ABI entry can differ from the one reported here.
	 */
	methods: FootprintMethod[];
}

/**
 * Static footprint of an expression: everything it can reference,
 * regardless of which branches or comprehension bodies execute.
 */
export interface FootprintResult {
	/**
	 * Referenced user contracts, sorted by name.
	 */
	contracts: ContractFootprint[];

	/**
	 * Referenced chain-state builtins, sorted. Entries are named
	 * `<receiverType>.<name>` after the schema `FunctionSchema`,
	 * e.g. "sol_address.balance", or `block.<field>` for the builtin block
	 * context, e.g. "block.timestamp". They do not depend on any contract ABI.
	 */
	builtins: string[];

	/**
	 * Referenced context variables, sorted. Comprehension and bind
	 * variables are excluded.
	 */
	variables: string[];
}
