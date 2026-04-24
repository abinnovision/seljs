import { SELError } from "./base.js";

/**
 * Base class for errors detected before expression evaluation starts:
 * parse errors, type-check errors, lint diagnostics, client validation,
 * and configuration/setup errors. Catch this to surface "the expression
 * or environment is wrong" without reacting to runtime failures.
 */
export class SELStaticError extends SELError {}
