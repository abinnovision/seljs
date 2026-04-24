import { SELError } from "./base.js";

/**
 * Base class for errors raised during expression evaluation or execution:
 * CEL runtime failures, Solidity type conversions, contract reverts,
 * provider/transport failures, and execution-framework limits. Catch this
 * to surface "the expression ran but something went wrong" without
 * reacting to static/setup errors.
 */
export class SELRuntimeError extends SELError {}
