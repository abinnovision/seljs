import type {
	ContractSchema,
	FunctionSchema,
	MacroSchema,
	MethodSchema,
	SELSchema,
	TypeSchema,
	VariableSchema,
} from "@seljs/schema";

/**
 * Creates a method schema for checker tests.
 * The `abi` field is required by MethodSchema but unused by the checker,
 * so we omit it here and cast to satisfy the type.
 */
const method = (m: Omit<MethodSchema, "abi">): MethodSchema =>
	m as MethodSchema;

/*
 * ---------------------------------------------------------------------------
 * Composable contract fragments
 * ---------------------------------------------------------------------------
 */

export const ERC20_CONTRACT: ContractSchema = {
	name: "erc20",
	address: "0x6B175474E89094C44Da98b954EedeAC495271d0F",
	methods: [
		method({
			name: "balanceOf",
			params: [{ name: "account", type: "sol_address" }],
			returns: "sol_int",
		}),
		method({
			name: "totalSupply",
			params: [],
			returns: "sol_int",
		}),
		method({
			name: "name",
			params: [],
			returns: "string",
		}),
		method({
			name: "symbol",
			params: [],
			returns: "string",
		}),
		method({
			name: "decimals",
			params: [],
			returns: "sol_int",
		}),
		method({
			name: "allowance",
			params: [
				{ name: "owner", type: "sol_address" },
				{ name: "spender", type: "sol_address" },
			],
			returns: "sol_int",
		}),
	],
};

export const ERC721_CONTRACT: ContractSchema = {
	name: "nft",
	address: "0xBC4CA0EdA7647A8aB7C2061c2E118A18a936f13D",
	methods: [
		method({
			name: "ownerOf",
			params: [{ name: "tokenId", type: "sol_int" }],
			returns: "sol_address",
		}),
		method({
			name: "balanceOf",
			params: [{ name: "owner", type: "sol_address" }],
			returns: "sol_int",
		}),
		method({
			name: "name",
			params: [],
			returns: "string",
		}),
		method({
			name: "symbol",
			params: [],
			returns: "string",
		}),
		method({
			name: "tokenURI",
			params: [{ name: "tokenId", type: "sol_int" }],
			returns: "string",
		}),
		method({
			name: "getApproved",
			params: [{ name: "tokenId", type: "sol_int" }],
			returns: "sol_address",
		}),
		method({
			name: "isApprovedForAll",
			params: [
				{ name: "owner", type: "sol_address" },
				{ name: "operator", type: "sol_address" },
			],
			returns: "bool",
		}),
	],
};

/*
 * ---------------------------------------------------------------------------
 * Common variables
 * ---------------------------------------------------------------------------
 */

export const COMMON_VARIABLES: VariableSchema[] = [
	{ name: "user", type: "sol_address", description: "Wallet address" },
	{ name: "spender", type: "sol_address", description: "Spender address" },
	{ name: "threshold", type: "sol_int", description: "Threshold amount" },
	{ name: "tokenId", type: "sol_int", description: "Token identifier" },
	{ name: "active", type: "bool", description: "Active flag" },
	{ name: "label", type: "string", description: "Label text" },
];

/*
 * ---------------------------------------------------------------------------
 * Built-in functions and receiver methods
 * ---------------------------------------------------------------------------
 */

export const BUILTIN_FUNCTIONS: FunctionSchema[] = [
	{
		name: "size",
		signature: "size(list|map|string): int",
		params: [{ name: "value", type: "list|map|string" }],
		returns: "int",
	},
	{
		name: "size",
		signature: "string.size(): int",
		params: [],
		returns: "int",
		receiverType: "string",
	},
	{
		name: "startsWith",
		signature: "string.startsWith(prefix): bool",
		params: [{ name: "prefix", type: "string" }],
		returns: "bool",
		receiverType: "string",
	},
	{
		name: "endsWith",
		signature: "string.endsWith(suffix): bool",
		params: [{ name: "suffix", type: "string" }],
		returns: "bool",
		receiverType: "string",
	},
	{
		name: "contains",
		signature: "string.contains(substring): bool",
		params: [{ name: "substring", type: "string" }],
		returns: "bool",
		receiverType: "string",
	},
	{
		name: "matches",
		signature: "string.matches(regex): bool",
		params: [{ name: "regex", type: "string" }],
		returns: "bool",
		receiverType: "string",
	},
];

export const BUILTIN_TYPES: TypeSchema[] = [
	{ name: "sol_address", kind: "primitive" },
	{ name: "sol_int", kind: "primitive" },
	{ name: "bool", kind: "primitive" },
	{ name: "string", kind: "primitive" },
	{ name: "bytes", kind: "primitive" },
];

export const BUILTIN_MACROS: MacroSchema[] = [
	{ name: "has", pattern: "has(expression)" },
	{ name: "all", pattern: "list.all(x, predicate)" },
	{ name: "exists", pattern: "list.exists(x, predicate)" },
	{ name: "filter", pattern: "list.filter(x, predicate)" },
	{ name: "map", pattern: "list.map(x, transform)" },
];

/*
 * ---------------------------------------------------------------------------
 * Schema composer — combine fragments into a full SELSchema
 * ---------------------------------------------------------------------------
 */

export interface SchemaOptions {
	contracts?: ContractSchema[];
	variables?: VariableSchema[];
	functions?: FunctionSchema[];
	types?: TypeSchema[];
	macros?: MacroSchema[];
}

export function createTestSchema(options: SchemaOptions = {}): SELSchema {
	return {
		version: "1.0.0",
		contracts: options.contracts ?? [],
		variables: options.variables ?? COMMON_VARIABLES,
		functions: options.functions ?? BUILTIN_FUNCTIONS,
		types: options.types ?? BUILTIN_TYPES,
		macros: options.macros ?? BUILTIN_MACROS,
	};
}

/*
 * ---------------------------------------------------------------------------
 * Pre-composed schemas for common test groups
 * ---------------------------------------------------------------------------
 */

/** ERC20 only — the most common test scenario */
export const ERC20_SCHEMA = createTestSchema({
	contracts: [ERC20_CONTRACT],
});

/** ERC721 only */
export const ERC721_SCHEMA = createTestSchema({
	contracts: [ERC721_CONTRACT],
});

/** Both ERC20 + ERC721 — for cross-contract tests */
export const FULL_SCHEMA = createTestSchema({
	contracts: [ERC20_CONTRACT, ERC721_CONTRACT],
});
