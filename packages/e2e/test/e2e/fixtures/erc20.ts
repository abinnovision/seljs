import { erc20 } from "@seljs-internal/fixtures";

import { defineFixtureGroup } from "../helpers.js";

const abi = erc20.abi;
const ADDRESS = "0x0000000000000000000000000000000000000020";

const USER = "0x0000000000000000000000000000000000000001";
const SPENDER = "0x0000000000000000000000000000000000000002";

export const erc20Fixtures = defineFixtureGroup({
	name: "ERC-20",
	contracts: {
		token: { abi, address: ADDRESS },
	},
	context: {
		user: "sol_address",
		spender: "sol_address",
	},
	cases: [
		{
			expr: "token.name()",
			expectedType: "string",
			mocks: { name: "Wrapped Ether" },
			expectedValue: "Wrapped Ether",
			completions: [
				{
					offset: 6,
					includes: [
						"name",
						"symbol",
						"decimals",
						"totalSupply",
						"balanceOf",
						"allowance",
					],
				},
			],
		},
		{
			expr: "token.symbol()",
			expectedType: "string",
			mocks: { symbol: "WETH" },
			expectedValue: "WETH",
		},
		{
			expr: "token.decimals()",
			expectedType: "sol_int",
			mocks: { decimals: 18 },
			expectedValue: BigInt(18),
		},
		{
			expr: "token.totalSupply()",
			expectedType: "sol_int",
			mocks: { totalSupply: 1000000000000000000000000n },
			expectedValue: 1000000000000000000000000n,
		},
		{
			expr: "token.balanceOf(user)",
			expectedType: "sol_int",
			mocks: { balanceOf: 500000000000000000000n },
			context: { user: USER, spender: SPENDER },
			expectedValue: 500000000000000000000n,
		},
		{
			expr: "token.allowance(user, spender)",
			expectedType: "sol_int",
			mocks: { allowance: 100000000000000000000n },
			context: { user: USER, spender: SPENDER },
			expectedValue: 100000000000000000000n,
		},

		// comparisons
		{
			expr: "token.balanceOf(user) > solInt(0)",
			expectedType: "bool",
			mocks: { balanceOf: 500000000000000000000n },
			context: { user: USER, spender: SPENDER },
			expectedValue: true,
		},
		{
			expr: "token.allowance(user, spender) > token.balanceOf(user)",
			expectedType: "bool",
			mocks: {
				allowance: 100000000000000000000n,
				balanceOf: 500000000000000000000n,
			},
			context: { user: USER, spender: SPENDER },
			expectedValue: false,
		},

		// arithmetic on return values
		{
			label: "arithmetic: sol_int + sol_int",
			expr: "token.balanceOf(user) + solInt(1000)",
			expectedType: "sol_int",
			mocks: { balanceOf: 500n },
			context: { user: USER, spender: SPENDER },
			expectedValue: 1500n,
		},
		{
			label: "arithmetic: sol_int - sol_int",
			expr: "token.totalSupply() - token.balanceOf(user)",
			expectedType: "sol_int",
			mocks: {
				totalSupply: 10000n,
				balanceOf: 3000n,
			},
			context: { user: USER, spender: SPENDER },
			expectedValue: 7000n,
		},
		{
			label: "arithmetic: sol_int * sol_int",
			expr: "token.balanceOf(user) * solInt(2)",
			expectedType: "sol_int",
			mocks: { balanceOf: 500n },
			context: { user: USER, spender: SPENDER },
			expectedValue: 1000n,
		},
		{
			label: "arithmetic: sol_int / sol_int",
			expr: "token.totalSupply() / solInt(4)",
			expectedType: "sol_int",
			mocks: { totalSupply: 10000n },
			expectedValue: 2500n,
		},
		{
			label: "arithmetic: sol_int % sol_int",
			expr: "token.totalSupply() % solInt(3)",
			expectedType: "sol_int",
			mocks: { totalSupply: 10000n },
			expectedValue: 1n,
		},

		// ternary operator
		{
			label: "ternary: bool ? string : string",
			expr: 'token.balanceOf(user) > solInt(0) ? "has balance" : "empty"',
			expectedType: "string",
			mocks: { balanceOf: 500n },
			context: { user: USER, spender: SPENDER },
			expectedValue: "has balance",
		},
		{
			label: "ternary: false branch",
			expr: 'token.balanceOf(user) > solInt(1000) ? "whale" : "small"',
			expectedType: "string",
			mocks: { balanceOf: 500n },
			context: { user: USER, spender: SPENDER },
			expectedValue: "small",
		},
		{
			label: "ternary: sol_int result branches",
			expr: "token.balanceOf(user) > solInt(100) ? token.balanceOf(user) : solInt(0)",
			expectedType: "sol_int",
			mocks: { balanceOf: 500n },
			context: { user: USER, spender: SPENDER },
			expectedValue: 500n,
		},

		// string receiver methods on contract returns
		{
			label: "string.size() on contract return",
			expr: "token.name().size()",
			expectedType: "int",
			mocks: { name: "Wrapped Ether" },
			expectedValue: 13n,
		},
		{
			label: "string.contains() on contract return",
			expr: 'token.name().contains("Ether")',
			expectedType: "bool",
			mocks: { name: "Wrapped Ether" },
			expectedValue: true,
		},
		{
			label: "string.contains() negative",
			expr: 'token.name().contains("Bitcoin")',
			expectedType: "bool",
			mocks: { name: "Wrapped Ether" },
			expectedValue: false,
		},
		{
			label: "string.startsWith() on contract return",
			expr: 'token.name().startsWith("Wrapped")',
			expectedType: "bool",
			mocks: { name: "Wrapped Ether" },
			expectedValue: true,
		},
		{
			label: "string.endsWith() on contract return",
			expr: 'token.symbol().endsWith("ETH")',
			expectedType: "bool",
			mocks: { symbol: "WETH" },
			expectedValue: true,
		},
		{
			label: "string.matches() regex on contract return",
			expr: 'token.symbol().matches("^W[A-Z]+")',
			expectedType: "bool",
			mocks: { symbol: "WETH" },
			expectedValue: true,
		},

		// cel.bind()
		{
			label: "cel.bind() with contract return value",
			expr: "cel.bind(bal, token.balanceOf(user), bal > solInt(0))",
			expectedType: "bool",
			mocks: { balanceOf: 500n },
			context: { user: USER, spender: SPENDER },
			expectedValue: true,
		},
		{
			label: "cel.bind() with arithmetic",
			expr: "cel.bind(supply, token.totalSupply(), supply / solInt(2))",
			expectedType: "sol_int",
			mocks: { totalSupply: 10000n },
			expectedValue: 5000n,
		},

		// combined expressions
		{
			label: "combined: arithmetic result in comparison",
			expr: "token.balanceOf(user) * solInt(100) / token.totalSupply() > solInt(0)",
			expectedType: "bool",
			mocks: {
				balanceOf: 500n,
				totalSupply: 10000n,
			},
			context: { user: USER, spender: SPENDER },
			expectedValue: true,
		},
		{
			label: "combined: string method in boolean expression",
			expr: 'token.name().contains("Ether") && token.balanceOf(user) > solInt(0)',
			expectedType: "bool",
			mocks: {
				name: "Wrapped Ether",
				balanceOf: 500n,
			},
			context: { user: USER, spender: SPENDER },
			expectedValue: true,
		},
		{
			label: "combined: ternary with string method",
			expr: 'token.name().contains("Wrapped") ? token.symbol() : "UNKNOWN"',
			expectedType: "string",
			mocks: {
				name: "Wrapped Ether",
				symbol: "WETH",
			},
			expectedValue: "WETH",
		},

		// sol_int <op> int arithmetic (left operand sol_int — correct result type)
		{
			label: "sol_int + int: balance + string length",
			expr: "token.balanceOf(user) + token.name().size()",
			expectedType: "sol_int",
			mocks: { balanceOf: 500n, name: "Wrapped Ether" },
			context: { user: USER, spender: SPENDER },
			expectedValue: 513n,
		},
		{
			label: "sol_int - int: balance - string length",
			expr: "token.balanceOf(user) - token.name().size()",
			expectedType: "sol_int",
			mocks: { balanceOf: 500n, name: "Wrapped Ether" },
			context: { user: USER, spender: SPENDER },
			expectedValue: 487n,
		},

		// parseUnits / formatUnits with sol_int decimals
		{
			label: "formatUnits with dynamic decimals via token.decimals()",
			expr: "formatUnits(token.balanceOf(user), token.decimals())",
			expectedType: "double",
			mocks: { balanceOf: 1500000n, decimals: 6 },
			context: { user: USER, spender: SPENDER },
			expectedValue: 1.5,
		},
		{
			label: "formatUnits with sol_int literal decimals",
			expr: "formatUnits(solInt(1500), solInt(3))",
			expectedType: "double",
			expectedValue: 1.5,
		},
		{
			label: "parseUnits with dynamic decimals via token.decimals()",
			expr: 'parseUnits("1", token.decimals())',
			expectedType: "sol_int",
			mocks: { decimals: 6 },
			expectedValue: 1000000n,
		},

		// EVM built-in constants
		{
			label: "WAD constant is 10^18",
			expr: "WAD",
			expectedType: "sol_int",
			expectedValue: 10n ** 18n,
		},
		{
			label: "balance comparison against WAD",
			expr: "token.balanceOf(user) > WAD",
			expectedType: "bool",
			mocks: { balanceOf: 2n * 10n ** 18n },
			context: { user: USER, spender: SPENDER },
			expectedValue: true,
		},
		{
			label: "Q96 used as Uniswap sqrtPriceX96 divisor",
			expr: "Q96 / Q96",
			expectedType: "sol_int",
			expectedValue: 1n,
		},

		// invalid
		{
			label: "invalid: token.balanceOf() missing required address arg",
			expr: "token.balanceOf()",
			expectedType: "",
			invalid: true,
			minDiagnostics: 1,
		},
		{
			label: "invalid: token.nonExistent()",
			expr: "token.nonExistent()",
			expectedType: "",
			invalid: true,
			minDiagnostics: 1,
		},
		{
			label: "invalid: size() on non-collection",
			expr: "token.decimals().size()",
			expectedType: "",
			invalid: true,
			minDiagnostics: 1,
		},
		{
			label: "invalid: contains() on non-string",
			expr: 'token.decimals().contains("x")',
			expectedType: "",
			invalid: true,
			minDiagnostics: 1,
		},
		{
			label: "invalid: arithmetic type mismatch sol_int + string",
			expr: 'token.balanceOf(user) + "hello"',
			expectedType: "",
			invalid: true,
			minDiagnostics: 1,
		},
	],
});
