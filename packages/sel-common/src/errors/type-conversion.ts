import { SELRuntimeError } from "./runtime-base.js";

/**
 * Thrown when a Solidity type wrapper rejects an input value — e.g. an
 * invalid address string, odd-length hex, non-integer `sol_int` input, or
 * a `parseUnits` decimal overflow. The offending value and the type it was
 * being converted to are carried on the error.
 */
export class SELTypeConversionError extends SELRuntimeError {
	public readonly expectedType: string;
	public readonly actualValue: unknown;

	public constructor(
		message: string,
		options: {
			cause?: unknown;
			expectedType: string;
			actualValue: unknown;
		},
	) {
		super(message, { cause: options.cause });
		this.expectedType = options.expectedType;
		this.actualValue = options.actualValue;
	}
}
