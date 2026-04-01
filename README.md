# SEL — Solidity Expression Language

[![npm version](https://badge.fury.io/js/@seljs%2Fruntime.svg)](https://www.npmjs.com/package/@seljs/runtime)
[![License: Apache-2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)

SEL is a TypeScript library for querying EVM smart contracts using [CEL](https://cel.dev/) expressions. It provides a declarative, type-safe way to fetch and evaluate on-chain data with automatic multicall batching, dependency resolution, and atomic reads pinned to a single block.

## Packages

| Package                                              | Description                                                         |
| ---------------------------------------------------- | ------------------------------------------------------------------- |
| [`@seljs/runtime`](./packages/sel-runtime)           | Core runtime — expression evaluation, contract execution, multicall |
| [`@seljs/env`](./packages/sel-env)                   | Schema builder — contracts and context definitions                  |
| [`@seljs/checker`](./packages/sel-checker)           | Expression checker — parse, type-check, and infer types             |
| [`@seljs/schema`](./packages/sel-schema)             | Schema types and JSON schema for editor integrations                |
| [`@seljs/types`](./packages/sel-types)               | Solidity ↔ CEL type system and conversions                          |
| [`@seljs/common`](./packages/sel-common)             | Shared utilities and error base classes                             |
| [`@seljs/editor`](./packages/sel-editor)             | CodeMirror language support (syntax, autocomplete, linting)         |
| [`@seljs/editor-react`](./packages/sel-editor-react) | React component for the SEL editor                                  |

## Installation

```bash
npm install @seljs/runtime @seljs/env
```

Peer dependencies: `typescript@^5`.

## Quick Start

```typescript
import { createSEL } from "@seljs/runtime";
import { buildSchema } from "@seljs/env";
import { createPublicClient, http, parseAbi } from "viem";
import { mainnet } from "viem/chains";

const client = createPublicClient({
  chain: mainnet,
  transport: http(),
});

const ERC20_ABI = parseAbi([
  "function balanceOf(address account) view returns (uint256)",
  "function totalSupply() view returns (uint256)",
]);

const schema = buildSchema({
  contracts: {
    token: {
      address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
      abi: ERC20_ABI,
    },
  },
  context: {
    user: "sol_address",
  },
});

const env = createSEL({ schema, client });

// parseUnits inside the expression handles decimal scaling (USDC has 6 decimals)
const result = await env.evaluate(
  "token.balanceOf(user) > parseUnits(1000, 6)",
  { user: "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045" },
);

console.log(result.value); // true or false
```

## Core Concepts

### CEL Expressions

SEL uses [Common Expression Language](https://cel.dev/) as its query syntax:

```typescript
// Arithmetic and comparisons
"token.balanceOf(user) > threshold";

// Logical operators
"balance > minBalance && balance < maxBalance";

// String operations
'name.startsWith("Crypto")';

// List macros
"tokens.all(t, t.balance > 0)";

// Map literals
'{"hasAccess": token.balanceOf(user) > threshold}';
```

### Built-in Functions

#### Type Casting

Contract calls return custom CEL types (`sol_int`, `sol_address`). To compare against literals, cast them with the corresponding functions:

```typescript
// Cast integer literals to sol_int
"token.balanceOf(user) > solInt(0)";

// Large constants as decimal strings
'token.balanceOf(user) >= solInt("1000000000000000000000")';

// Cast string literals to sol_address
'token.balanceOf(solAddress("0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045"))';
```

#### Unit Conversion

`parseUnits` and `formatUnits` convert between human-readable values and scaled `sol_int` values, mirroring viem/ethers behavior:

```typescript
// 1000 USDC (6 decimals) → sol_int(1000000000)
"token.balanceOf(user) > parseUnits(1000, 6)";

// Decimal strings for precise amounts
'token.balanceOf(user) >= parseUnits("1.5", 18)';

// Format a sol_int back to a human-readable double
"formatUnits(token.balanceOf(user), 18) > 1.0";
```

#### Math and Address Utilities

```typescript
// min / max — return the smaller or larger of two values
"min(token.balanceOf(user), cap)";
"max(balance, solInt(0))";

// abs — absolute value
"abs(priceChange)";

// isZeroAddress — check if an address is the zero address
"isZeroAddress(token.ownerOf(tokenId))";
```

### Schema Builder

The schema is built separately from the runtime using `buildSchema` from `@seljs/env`. This decouples schema definition from execution — the same schema can be used for type-checking, editor support, and runtime evaluation.

```typescript
import { buildSchema } from "@seljs/env";

const schema = buildSchema({
  contracts: {
    token: { address: "0x...", abi: ERC20_ABI },
  },
  context: {
    user: "sol_address", // Ethereum address
    amount: "sol_int", // non-negative bigint (uint256)
    balance: "sol_int", // bigint (int256)
    active: "bool", // boolean
    name: "string", // string
    data: "bytes", // raw bytes
  },
});
```

Context fields can also be defined as objects with a description, which is surfaced in editor tooling:

```typescript
const schema = buildSchema({
  contracts: {
    token: { address: "0x...", abi: ERC20_ABI },
  },
  context: {
    user: { type: "sol_address", description: "The wallet address to check" },
    threshold: {
      type: "sol_int",
      description: "Minimum token balance required",
    },
  },
});
```

Context keys are mapped directly to CEL types for type-checking and runtime evaluation.

### Lint Rules

Lint rules analyze the expression AST **before** any on-chain calls happen. They are passed via the `rules` option and come in two severities:

- **Error** — enforcement rules that cause the runtime to throw `SELLintError` before execution
- **Warning / Info** — advisory rules that surface in `result.diagnostics` without blocking execution

```typescript
import { createSEL } from "@seljs/runtime";
import { expressionComplexity, requireType, rules } from "@seljs/checker";

const env = createSEL({
  schema,
  client,
  rules: [
    // Enforcement — throws SELLintError if violated
    requireType("bool"),
    expressionComplexity({ maxAstNodes: 50, maxDepth: 8 }),

    // Advisory — warnings/info in result.diagnostics
    ...rules.builtIn,
  ],
});

try {
  const result = await env.evaluate("token.balanceOf(user) > solInt(0)", {
    user: "0x...",
  });
  console.log(result.diagnostics); // advisory warnings, if any
} catch (error) {
  if (error instanceof SELLintError) {
    console.log(error.diagnostics); // which rules were violated
  }
}
```

#### Expression Complexity

The `expressionComplexity` rule measures five AST metrics. Each can be configured independently — set to `Infinity` to disable a metric:

| Metric         | What it measures                                     | Default |
| -------------- | ---------------------------------------------------- | ------- |
| `maxAstNodes`  | Total AST node count                                 | 50      |
| `maxDepth`     | Maximum nesting depth                                | 8       |
| `maxCalls`     | Contract method call nodes in the AST                | 10      |
| `maxOperators` | Arithmetic, comparison, and membership operators     | 15      |
| `maxBranches`  | Ternary (`?:`) and logical (`&&`, `\|\| `) branching | 6       |

`maxOperators` and `maxBranches` are distinct — `&&`/`||` count as branches only, not operators.

#### Built-in Advisory Rules

| Rule                    | Severity | What it catches                              |
| ----------------------- | -------- | -------------------------------------------- |
| `no-redundant-bool`     | warning  | `x == true` — simplify to `x`                |
| `no-constant-condition` | warning  | `true && x` — likely a mistake               |
| `no-self-comparison`    | warning  | `x == x` — always true                       |
| `no-mixed-operators`    | info     | `a && b \|\| c` — add parens for clarity     |
| `deferred-call`         | info     | Contract call can't be batched via multicall |

### Automatic Multicall Batching

Independent contract calls within the same expression are batched into a single Multicall3 RPC call:

```typescript
// Both calls are independent — batched into 1 RPC request
const result = await env.evaluate(
  "token.balanceOf(user) + nft.balanceOf(user)",
  { user: "0x..." },
);
```

### Multi-Round Execution

Dependent calls are automatically detected and executed in rounds:

```typescript
// Round 1: staking.stakedTokenId(user)
// Round 2: nft.ownerOf(<result from round 1>)
const result = await env.evaluate("nft.ownerOf(staking.stakedTokenId(user))", {
  user: "0x...",
});
```

All rounds execute against the same block number, ensuring atomicity.

## Examples

### Access Control

```typescript
const schema = buildSchema({
  contracts: {
    membership: { address: MEMBERSHIP_ADDR, abi: ERC721_ABI },
    token: { address: TOKEN_ADDR, abi: ERC20_ABI },
  },
  context: { user: "sol_address" },
});

const env = createSEL({ schema, client });

const { value: hasAccess } = await env.evaluate(
  'membership.balanceOf(user) >= solInt(1) || token.balanceOf(user) >= solInt("1000000000000000000000")',
  { user: "0x..." },
);
```

### Dependent Contract Calls

```typescript
const schema = buildSchema({
  contracts: {
    staking: { address: STAKING_ADDR, abi: STAKING_ABI },
    nft: { address: NFT_ADDR, abi: NFT_ABI },
  },
  context: { user: "sol_address" },
});

const env = createSEL({ schema, client });

// Automatically resolves: staking call first, then nft call with the result
const { value: tokenOwner } = await env.evaluate(
  "nft.ownerOf(staking.stakedTokenId(user))",
  { user: "0x..." },
);
```

### Dashboard Data Fetching

```typescript
const schema = buildSchema({
  contracts: {
    usdc: { address: USDC_ADDR, abi: ERC20_ABI },
    weth: { address: WETH_ADDR, abi: ERC20_ABI },
    nft: { address: BAYC_ADDR, abi: ERC721_ABI },
  },
  context: { user: "sol_address" },
});

const env = createSEL({ schema, client });

// All independent calls batched into a single RPC request
const { value } = await env.evaluate(
  `{
    "usdcBalance": usdc.balanceOf(user),
    "wethBalance": weth.balanceOf(user),
    "nftCount": nft.balanceOf(user),
    "hasTokens": usdc.balanceOf(user) > solInt(0) || weth.balanceOf(user) > solInt(0)
  }`,
  { user: "0x..." },
);
```

## Execution Limits

`SELLimits` controls how many resources the runtime can consume during contract call execution:

```typescript
const env = createSEL({
  schema,
  client,
  limits: {
    maxRounds: 10, // max dependency-ordered execution rounds (default: 10)
    maxCalls: 100, // max total contract calls across all rounds (default: 100)
  },
});
```

These are hard limits — exceeding them throws `ExecutionLimitError`. They protect against runaway execution when expressions contain deeply chained or recursive contract calls.

For static complexity analysis (AST node count, nesting depth, etc.), use the [`expressionComplexity` lint rule](#expression-complexity) instead — it rejects overly complex expressions before any on-chain calls happen.

### Recommended Defaults for Untrusted Input

When evaluating user-authored expressions (e.g., from a frontend editor), use both layers together:

```typescript
import { expressionComplexity, requireType, rules } from "@seljs/checker";

const env = createSEL({
  schema,
  client,
  limits: {
    maxRounds: 5, // tighter than default — limits chained RPC calls
    maxCalls: 20, // limits total on-chain calls
  },
  rules: [
    requireType("bool"), // expressions must resolve to a boolean
    expressionComplexity({
      maxAstNodes: 40, // reject overly large expressions
      maxDepth: 6, // prevent deeply nested logic
      maxCalls: 8, // limit contract call complexity
      maxOperators: 12, // cap arithmetic/comparison density
      maxBranches: 4, // limit branching complexity
    }),
    ...rules.builtIn, // no-redundant-bool, no-constant-condition, etc.
  ],
});
```

**Execution limits** are a safety net that catches runaway execution at the RPC level. **Lint rules** reject bad expressions early with actionable error messages — before any gas is spent.

## Error Handling

All errors extend `SELError`. Catch specific types for granular handling:

| Error                     | When                                                          |
| ------------------------- | ------------------------------------------------------------- |
| `SELEvaluationError`      | Expression evaluation fails (undefined variables, etc.)       |
| `SELLintError`            | Lint rule with error severity violated (`.diagnostics`)       |
| `SELContractError`        | Contract call fails (includes `.contractName`, `.methodName`) |
| `CircularDependencyError` | Circular dependency in call graph                             |
| `ExecutionLimitError`     | `maxRounds` or `maxCalls` exceeded                            |
| `MulticallBatchError`     | Multicall3 batch execution fails                              |

## Type Mapping

| Solidity                    | CEL           | JavaScript   |
| --------------------------- | ------------- | ------------ |
| `uint8`–`uint256`           | `sol_int`     | `bigint`     |
| `int8`–`int256`             | `sol_int`     | `bigint`     |
| `bool`                      | `bool`        | `boolean`    |
| `address`                   | `sol_address` | `string`     |
| `string`                    | `string`      | `string`     |
| `bytes`, `bytes1`–`bytes32` | `bytes`       | `Uint8Array` |
| `T[]`, `T[N]`               | `list<T>`     | `Array`      |
| `tuple`                     | `map`         | `Object`     |

### Why `sol_int` and `sol_address`?

SEL registers custom CEL types instead of using the built-in `int` and `string` types:

- **`sol_int`** — Wraps all Solidity integer types (`uint8`–`uint256`, `int8`–`int256`) as a single CEL type backed by native `BigInt`. This bypasses cel-js's built-in `int` type which enforces 64-bit overflow checks — necessary because Solidity integers go up to 256 bits. Cast literals with `solInt(0)` or `solInt("1000000000000000000")`.
- **`sol_address`** — Wraps Solidity `address` as a dedicated CEL type with hex validation and lowercase normalization. This ensures address comparisons are case-insensitive (matching EVM semantics) rather than relying on plain string equality.

## Credits

- [@marcbachmann/cel-js](https://github.com/marcbachmann/cel-js) — CEL parser, type checker, and evaluator
- [viem](https://viem.sh/) — Ethereum client, ABI encoding/decoding

## License

Apache-2.0
