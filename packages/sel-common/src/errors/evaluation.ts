import { SELRuntimeError } from "./runtime-base.js";

/**
 * Thrown when CEL expression evaluation fails — e.g. a builtin rejects its
 * arguments (length mismatch, division by zero) or cel-js reports a runtime
 * failure. Lives in `@seljs/common` so checker-side builtins can throw it
 * directly without depending on `@seljs/runtime`.
 */
export class SELEvaluationError extends SELRuntimeError {}
