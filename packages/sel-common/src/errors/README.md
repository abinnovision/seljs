# SEL Error Hierarchy

Every error thrown from a SEL subsystem (cel-js integration, Solidity type
wrappers, contract execution, provider/RPC transport, lint, configuration)
is a subclass of `SELError`. Callers can catch the root to handle any SEL
failure, or narrow down by branch (static vs runtime) or leaf class.

```
Error                                    (native JS)
└── SELError                             (root)
    ├── SELStaticError                   — detected before evaluation
    │   ├── SELParseError                — CEL syntax errors
    │   ├── SELTypeCheckError            — CEL type-checker errors
    │   ├── SELLintError                 — lint rule violations
    │   ├── SELClientError               — client validation failures
    │   └── SELConfigError               — setup / codec registry / ABI registration
    │
    └── SELRuntimeError                  — raised during evaluation
        ├── SELEvaluationError           — CEL runtime failures, builtin rejections
        ├── SELTypeConversionError       — sol_int / sol_address / hex / units
        ├── SELContractError             — contract-layer failures (execution reached chain)
        │   ├── SELContractRevertError   — the call reverted (reason / data / decoded)
        │   └── SELMulticallBatchError   — Multicall3 aggregate-level failures
        ├── SELProviderError             — transport / RPC (call never reached the contract)
        │   ├── SELProviderTransportError — HTTP / WebSocket / timeout
        │   └── SELProviderRpcError       — JSON-RPC error response from node
        └── SELExecutionError            — execution-framework failures
            ├── SELExecutionLimitError    — maxRounds / maxCalls exceeded
            └── SELCircularDependencyError — dep-graph cycle detected
```

## When each class is thrown

| Class                        | Thrown from                                                                                                                                                       | Fields beyond `message` / `cause`                               |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| `SELParseError`              | cel-js reported a syntax error while parsing the expression                                                                                                       | `position?: { line; column }`                                   |
| `SELTypeCheckError`          | cel-js rejected the expression during type-check                                                                                                                  | —                                                               |
| `SELLintError`               | Lint rules with `error` severity matched the expression                                                                                                           | `diagnostics: SELDiagnostic[]`                                  |
| `SELClientError`             | The client passed into `createSEL` failed validation                                                                                                              | —                                                               |
| `SELConfigError`             | Missing codec registry, unknown ABI registered for a contract referenced by the expression                                                                        | `setting?: string`                                              |
| `SELEvaluationError`         | cel-js evaluation threw, a builtin rejected its arguments (empty list min/max, division by zero, length mismatch), or any non-viem/non-cel runtime error was seen | —                                                               |
| `SELTypeConversionError`     | A Solidity type wrapper rejected an input (`sol_int`, `sol_address`, `hexToBytes`, `parseUnits`)                                                                  | `expectedType: string`, `actualValue: unknown`                  |
| `SELContractError`           | Contract call failed for a non-revert reason (unknown method, return-data shape mismatch, viem `ContractFunctionExecutionError` / ABI decode)                     | `contractName?`, `methodName?`                                  |
| `SELContractRevertError`     | The call reached the chain and reverted                                                                                                                           | `revertReason?`, `revertData?`, `decodedError?: { name; args }` |
| `SELMulticallBatchError`     | Multicall3 itself reverted or encoding/decoding failed at batch level (individual sub-call reverts surface as `SELContractRevertError`)                           | `failedCallIndex?`                                              |
| `SELProviderTransportError`  | HTTP 5xx, socket disconnect, request timeout, body parse failure                                                                                                  | `httpStatus?`, `url?`, `body?`                                  |
| `SELProviderRpcError`        | Node returned a JSON-RPC error (rate limit, invalid params, unsupported method, user rejection)                                                                   | `rpcCode?`, `rpcData?`, `method?`                               |
| `SELExecutionLimitError`     | `maxRounds` or `maxCalls` exceeded                                                                                                                                | `limitType: "maxRounds"\|"maxCalls"`, `limit`, `actual`         |
| `SELCircularDependencyError` | The dependency graph contains a cycle                                                                                                                             | `callIds: string[]`                                             |

## Catching cookbook

### Editor / IDE integration

Catch static errors to render diagnostics inline; ignore runtime errors.

```ts
try {
  await sel.check(expression);
} catch (err) {
  if (err instanceof SELStaticError) {
    showSquiggly(err); // parse, type-check, lint, config
  } else {
    throw err; // runtime errors shouldn't happen during check()
  }
}
```

### Batch runner

Treat runtime errors as "expression failed at execution", separate from
setup/validation errors.

```ts
try {
  return await sel.evaluate(expression, context);
} catch (err) {
  if (err instanceof SELStaticError) markExpressionInvalid(err);
  else if (err instanceof SELRuntimeError) markExecutionFailed(err);
  else throw err;
}
```

### Retry-on-provider-only

Provider errors are transient; contract errors are deterministic. Retry
only the provider branch.

```ts
try {
  return await sel.evaluate(expression, context);
} catch (err) {
  if (err instanceof SELProviderError) {
    return retryWithFallbackRpc(expression, context);
  }
  throw err;
}
```

### Revert UX

`SELContractRevertError` carries three progressively more structured views
of the revert:

```ts
catch (err) {
  if (err instanceof SELContractRevertError) {
    // 1. Custom error decoded from the ABI — most useful to show
    if (err.decodedError) {
      render(`${err.decodedError.name}(${err.decodedError.args.join(", ")})`);
      return;
    }
    // 2. Standard Error(string) reason
    if (err.revertReason) {
      render(err.revertReason);
      return;
    }
    // 3. Raw bytes for manual inspection
    render(`Reverted with data: ${err.revertData ?? "0x"}`);
  }
}
```

### Viem interop

The original viem error is always attached as `cause`; use it to reach
metadata (`metaMessages`, `docsPath`, specific class) without relying on
it in business logic.

```ts
catch (err) {
  if (err instanceof SELProviderError && err.cause instanceof BaseError) {
    console.debug(err.cause.metaMessages?.join("\n"));
    console.debug(err.cause.docsPath);
  }
  throw err;
}
```

## Design invariants

- **Root**: `SELError` extends native `Error`. No other inheritance.
- **Two branches**: every leaf extends exactly one of `SELStaticError` or
  `SELRuntimeError`. Asking "static or runtime?" is a single `instanceof`.
- **Contract vs provider**: `SELContractError` means execution reached the
  chain; `SELProviderError` means it did not. Retry logic depends on this.
- **Revert vs non-revert**: `SELContractRevertError` carries decoded revert
  info; `SELContractError` (base) does not.
- **No raw errors escape**: the wrapper in
  `@seljs/runtime`'s `error-wrapper.ts` translates every cel-js and viem
  error into a SEL class before it surfaces to user code. Any generic
  `Error` seen there becomes `SELEvaluationError`.
