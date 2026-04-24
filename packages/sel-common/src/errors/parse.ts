import { SELStaticError } from "./static-base.js";

/**
 * Thrown when parsing a CEL expression fails. Raised before type-check or
 * evaluation — fix the expression source to resolve. When the underlying
 * cel-js `ParseError` provides position info, it is forwarded here.
 */
export class SELParseError extends SELStaticError {
	public readonly position?: { line: number; column: number };

	public constructor(
		message: string,
		options?: {
			cause?: unknown;
			position?: { line: number; column: number };
		},
	) {
		super(message, { cause: options?.cause });
		this.position = options?.position;
	}
}
