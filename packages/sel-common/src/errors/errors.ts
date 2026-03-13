import { SELError } from "./base.js";

/**
 * Thrown when CEL expression parsing fails.
 * Wraps cel-js ParseError with additional context.
 */
export class SELParseError extends SELError {}

/**
 * Thrown when Solidity type validation fails.
 * Used for type checking errors specific to Solidity types.
 */
export class SELTypeError extends SELError {}
