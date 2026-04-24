import { SELStaticError } from "./static-base.js";

/**
 * Thrown when the CEL type-checker rejects an expression — e.g. a function
 * call whose argument types don't match any registered signature. Raised
 * at `check()` / `evaluate()` time before any contract call fires.
 */
export class SELTypeCheckError extends SELStaticError {}
