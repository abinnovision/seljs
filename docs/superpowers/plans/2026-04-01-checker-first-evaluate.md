# Checker-First Evaluate Pipeline

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move all parse/type validation into SELChecker, remove SELParseError and SELTypeError, and simplify the evaluate pipeline so the checker is the single validation gate.

**Architecture:** The checker already performs parse + type-check + lint rules internally. Currently `planExecution()` duplicates parse and type-check before calling the checker. This change makes the checker the first and only validation gate — invalid expressions never reach `env.parse()`. The runtime's `env.parse()` stays because it produces the callable evaluation function. `SELParseError` and `SELTypeError` are removed; `wrapError()` collapses CEL parse/type errors into `SELEvaluationError` (these are "should never happen" paths). The checker's resolved `.type` replaces `typeCheckResult.type` for result encoding.

**Tech Stack:** TypeScript, vitest

---

### Task 1: Restructure `planExecution()` — checker first

**Files:**
- Modify: `packages/sel-runtime/src/environment/environment.ts:227-290`

- [ ] **Step 1: Write the failing test**

Add a test in `packages/sel-runtime/src/environment/environment.spec.ts` that verifies parse errors from `evaluate()` now throw `SELLintError` (not `SELParseError`):

```typescript
import { SELLintError } from "../errors/index.js";

it("wraps parse errors as SELLintError with diagnostics", async () => {
	const env = new SELRuntime({ schema: buildSchema({}) });
	await expect(env.evaluate("+++")).rejects.toBeInstanceOf(SELLintError);
	await expect(env.evaluate("+++")).rejects.toSatisfy(
		(e) => (e as SELLintError).diagnostics.length > 0,
	);
});

it("wraps type errors for unknown variables as SELLintError with diagnostics", async () => {
	const env = new SELRuntime({ schema: buildSchema({}) });
	await expect(env.evaluate("nonexistent_var")).rejects.toBeInstanceOf(
		SELLintError,
	);
	await expect(env.evaluate("nonexistent_var")).rejects.toSatisfy(
		(e) => (e as SELLintError).diagnostics.length > 0,
	);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `yarn vitest run packages/sel-runtime/src/environment/environment.spec.ts`
Expected: The two new tests FAIL (currently throws `SELParseError`/`SELTypeError`)

- [ ] **Step 3: Restructure `planExecution()`**

Replace the body of `planExecution()` in `packages/sel-runtime/src/environment/environment.ts` (lines 237-289). The new flow:

1. Checker runs first — validates parse, types, and lint rules
2. `env.parse()` runs only on valid expressions — gets the callable
3. `collectCalls()` + context normalization use the AST from `env.parse()`
4. Checker's `result.type` replaces `typeCheckResult.type`

```typescript
private planExecution(
	expression: string,
	evaluationContext: Record<string, unknown>,
): {
	parseResult: ReturnType<Environment["parse"]>;
	collectedCalls: CollectedCall[];
	normalizedContext: Record<string, unknown> | undefined;
	executionVariables: Record<string, unknown>;
	resolvedType: string | undefined;
	diagnostics: SELDiagnostic[];
} {
	// Gate: checker validates parse, types, and lint rules
	const checkResult = this.checker.check(expression);

	const errorDiags = checkResult.diagnostics.filter(
		(d) => d.severity === "error",
	);
	if (!checkResult.valid || errorDiags.length > 0) {
		throw new SELLintError(
			errorDiags.length > 0
				? errorDiags
				: checkResult.diagnostics.filter((d) => d.severity === "error"),
		);
	}

	// Expression is valid — parse for execution (runtime env with contract bindings)
	const parseResult = this.env.parse(expression);

	const collectedCalls = collectCalls(parseResult.ast, {
		get: (name: string) => this.findContract(name),
	});

	debug("evaluate: collected %d calls", collectedCalls.length);

	const normalizedContext = Object.keys(evaluationContext).length
		? normalizeContextForEvaluation(
				evaluationContext,
				this.variableTypes,
				this.codecRegistry,
			)
		: undefined;

	const executionVariables = Object.keys(evaluationContext).length
		? evaluationContext
		: {};

	// Advisory: warning/info diagnostics pass through to result
	const diagnostics = checkResult.diagnostics.filter(
		(d) => d.severity !== "error",
	);

	return {
		parseResult,
		collectedCalls,
		normalizedContext,
		executionVariables,
		resolvedType: checkResult.type,
		diagnostics,
	};
}
```

- [ ] **Step 4: Update `doEvaluate()` to use `resolvedType` instead of `typeCheckResult`**

In the same file, update the destructuring at line ~399 and the usages at lines ~449-464. Change:

```typescript
// Old destructuring
const {
	parseResult,
	collectedCalls,
	normalizedContext,
	executionVariables,
	typeCheckResult,
	diagnostics,
} = this.planExecution(expression, context ?? {});
```

to:

```typescript
// New destructuring
const {
	parseResult,
	collectedCalls,
	normalizedContext,
	executionVariables,
	resolvedType,
	diagnostics,
} = this.planExecution(expression, context ?? {});
```

And update the result encoding (around line 449):

```typescript
const value = (
	resolvedType
		? this.codecRegistry.encode(resolvedType, result)
		: result
) as T;

debug("evaluate: result type=%s", typeof value);

const evalResult: EvaluateResult<T> = executionMeta
	? { value, meta: executionMeta }
	: { value };

if (resolvedType) {
	evalResult.type = resolvedType;
}
```

- [ ] **Step 5: Remove `TypeCheckResult` import if no longer used**

In `environment.ts`, remove `TypeCheckResult` from the `@marcbachmann/cel-js` import if it's no longer referenced anywhere in the file.

- [ ] **Step 6: Update JSDoc on `evaluate()`**

Update the `@throws` documentation (around line 201) — remove `SELParseError` and `SELTypeError`, add `SELLintError`:

```typescript
* @throws {@link SELLintError} If the expression fails parse, type-check, or lint rules
* @throws {@link SELContractError} If a contract call fails or no client is available
* @throws {@link SELEvaluationError} If CEL evaluation fails
```

- [ ] **Step 7: Remove old test cases, keep new ones**

In `packages/sel-runtime/src/environment/environment.spec.ts`, remove the old `"error wrapping"` describe block (lines 194-208) that asserts `SELParseError` and `SELTypeError`. The new tests from Step 1 replace them.

Also remove the `SELParseError` and `SELTypeError` imports from this file.

- [ ] **Step 8: Run tests to verify they pass**

Run: `yarn vitest run packages/sel-runtime/src/environment/environment.spec.ts`
Expected: ALL tests PASS

- [ ] **Step 9: Commit**

```bash
git add packages/sel-runtime/src/environment/environment.ts packages/sel-runtime/src/environment/environment.spec.ts
git commit -m "refactor: make checker the single validation gate in evaluate pipeline"
```

---

### Task 2: Collapse `wrapError()` — remove ParseError/TypeError branches

**Files:**
- Modify: `packages/sel-runtime/src/environment/error-wrapper.ts`
- Modify: `packages/sel-runtime/src/environment/error-wrapper.spec.ts`

- [ ] **Step 1: Update `wrapError()` tests**

In `packages/sel-runtime/src/environment/error-wrapper.spec.ts`, change the `ParseError` and `CelTypeError` test cases to assert `SELEvaluationError` instead:

```typescript
it("wraps ParseError as SELEvaluationError", () => {
	const err = new ParseError("bad syntax");
	const result = wrapError(err);
	expect(result).toBeInstanceOf(SELEvaluationError);
	expect(result.message).toBe("bad syntax");
	expect(result.cause).toBe(err);
});

it("wraps CelTypeError as SELEvaluationError", () => {
	const err = new CelTypeError("type mismatch");
	const result = wrapError(err);
	expect(result).toBeInstanceOf(SELEvaluationError);
	expect(result.message).toBe("type mismatch");
	expect(result.cause).toBe(err);
});
```

Remove the `SELParseError` and `SELTypeError` imports. Keep `SELEvaluationError`.

- [ ] **Step 2: Run tests to verify they fail**

Run: `yarn vitest run packages/sel-runtime/src/environment/error-wrapper.spec.ts`
Expected: The two updated tests FAIL

- [ ] **Step 3: Update `wrapError()` implementation**

In `packages/sel-runtime/src/environment/error-wrapper.ts`, replace the `ParseError` and `CelTypeError` branches to return `SELEvaluationError`:

```typescript
import {
	TypeError as CelTypeError,
	EvaluationError,
	ParseError,
} from "@marcbachmann/cel-js";

import {
	SELContractError,
	SELEvaluationError,
} from "../errors/index.js";

export const wrapError = (error: unknown): Error => {
	if (error instanceof SELContractError) {
		return error;
	}

	if (error instanceof EvaluationError) {
		const cause = (error as EvaluationError & { cause?: unknown }).cause;
		if (cause instanceof SELContractError) {
			return cause;
		}

		return new SELEvaluationError(error.message, { cause: error });
	}

	if (error instanceof ParseError) {
		return new SELEvaluationError(error.message, { cause: error });
	}

	if (error instanceof CelTypeError) {
		return new SELEvaluationError(error.message, { cause: error });
	}

	if (error instanceof Error) {
		return error;
	}

	return new Error(String(error));
};
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `yarn vitest run packages/sel-runtime/src/environment/error-wrapper.spec.ts`
Expected: ALL tests PASS

- [ ] **Step 5: Commit**

```bash
git add packages/sel-runtime/src/environment/error-wrapper.ts packages/sel-runtime/src/environment/error-wrapper.spec.ts
git commit -m "refactor: collapse ParseError and TypeError into SELEvaluationError in wrapError"
```

---

### Task 3: Remove `SELParseError` and `SELTypeError` from `sel-runtime`

**Files:**
- Modify: `packages/sel-runtime/src/errors/errors.ts`
- Modify: `packages/sel-runtime/src/errors/errors.spec.ts`
- Modify: `packages/sel-runtime/src/environment/environment.ts` (remove import)

- [ ] **Step 1: Remove re-exports from `errors.ts`**

In `packages/sel-runtime/src/errors/errors.ts`, change:

```typescript
import { SELError, SELParseError, SELTypeError } from "@seljs/common";
export { SELError, SELParseError, SELTypeError };
```

to:

```typescript
import { SELError } from "@seljs/common";
export { SELError };
```

- [ ] **Step 2: Remove from `environment.ts` imports**

In `packages/sel-runtime/src/environment/environment.ts`, remove `SELTypeError` from the import on line 22 (it should already be unused after Task 1).

- [ ] **Step 3: Update `errors.spec.ts`**

In `packages/sel-runtime/src/errors/errors.spec.ts`:

Remove `SELParseError` and `SELTypeError` from the import (line 8-9) and remove their entries from the `errorCases` array (the `SELParseError` and `SELTypeError` objects around lines 28-33).

Update the `"distinguishes between error types"` test (line 113-120) to use two remaining error types:

```typescript
it("distinguishes between error types", () => {
	const contractErr = new SELContractError("contract", {});
	const evalErr = new SELEvaluationError("eval");
	expect(contractErr).toBeInstanceOf(SELContractError);
	expect(contractErr).not.toBeInstanceOf(SELEvaluationError);
	expect(evalErr).toBeInstanceOf(SELEvaluationError);
	expect(evalErr).not.toBeInstanceOf(SELContractError);
});
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `yarn vitest run packages/sel-runtime/src/errors/errors.spec.ts`
Expected: ALL tests PASS

- [ ] **Step 5: Commit**

```bash
git add packages/sel-runtime/src/errors/errors.ts packages/sel-runtime/src/errors/errors.spec.ts packages/sel-runtime/src/environment/environment.ts
git commit -m "refactor: remove SELParseError and SELTypeError from sel-runtime"
```

---

### Task 4: Remove `SELParseError` and `SELTypeError` from `sel-common`

**Files:**
- Modify: `packages/sel-common/src/errors/errors.ts`
- Modify: `packages/sel-common/src/errors/errors.spec.ts`

- [ ] **Step 1: Remove classes from `errors.ts`**

In `packages/sel-common/src/errors/errors.ts`, remove both classes entirely. The file becomes empty (or remove it if `SELError` base is in `base.ts`). The file should become:

```typescript
// (empty — SELParseError and SELTypeError have been removed)
```

Or if other code imports from this path, keep the file but empty of exports.

- [ ] **Step 2: Remove tests from `errors.spec.ts`**

In `packages/sel-common/src/errors/errors.spec.ts`, remove all test code that references `SELParseError` or `SELTypeError`. This is the entire file content — the `sELParseError` describe, `sELTypeError` describe, `error class distinctions` describe, and `error wrapping with cause` describe blocks. The file can be deleted or left with an empty describe.

- [ ] **Step 3: Check for any remaining imports of these classes from `@seljs/common`**

Run: `grep -r "SELParseError\|SELTypeError" packages/ --include="*.ts" -l`

Fix any remaining references. The only expected one is the `diagnostic-mapper.ts` JSDoc comment — update that comment:

In `packages/sel-editor/src/linting/diagnostic-mapper.ts`, change the comment on line 13:

```typescript
 * 2. Thrown exception: `SELEvaluationError`
```

- [ ] **Step 4: Run full test suite**

Run: `yarn test`
Expected: ALL tests PASS across all packages

- [ ] **Step 5: Commit**

```bash
git add packages/sel-common/src/errors/errors.ts packages/sel-common/src/errors/errors.spec.ts packages/sel-editor/src/linting/diagnostic-mapper.ts
git commit -m "refactor: remove SELParseError and SELTypeError from sel-common"
```

---

### Task 5: Update JSDoc on `check()` method

**Files:**
- Modify: `packages/sel-runtime/src/environment/environment.ts:171-184`

- [ ] **Step 1: Update `check()` JSDoc**

The `check()` method's `@throws` on line 176 references `SELTypeError`. Update:

```typescript
/**
 * Type-checks an expression against registered variables and contract methods.
 *
 * @param expression - A CEL expression string to type-check
 * @returns The type-check result containing validity, inferred type, and any errors
 * @throws {@link SELEvaluationError} If the expression contains unrecoverable errors
 */
```

- [ ] **Step 2: Update README if it references these error types**

In `README.md` around line 390, update the error table to remove `SELParseError` and `SELTypeError` rows. The checker now catches these as `SELLintError` diagnostics.

- [ ] **Step 3: Run build to verify no type errors**

Run: `yarn build`
Expected: Build succeeds with no errors

- [ ] **Step 4: Run full test suite one final time**

Run: `yarn test`
Expected: ALL tests PASS

- [ ] **Step 5: Commit**

```bash
git add packages/sel-runtime/src/environment/environment.ts README.md
git commit -m "docs: update JSDoc and README to reflect new error hierarchy"
```
