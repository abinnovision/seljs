import { hasCaptureStackTrace } from "./utils.js";

/**
 * Base error class for SEL (Solidity Expression Language).
 * All SEL errors extend this class, enabling catch-all handling
 * via `instanceof SELError`.
 */
export class SELError extends Error {
	public constructor(message: string, options?: ErrorOptions) {
		super(message, options);
		this.name = this.constructor.name;

		// Capture stack trace for better debugging (V8 engines).
		if (hasCaptureStackTrace(Error)) {
			Error.captureStackTrace(this, this.constructor);
		}
	}
}
