import { SELStaticError } from "./static-base.js";

/**
 * Thrown when the SEL environment is misconfigured — missing codec
 * registry entry, unknown ABI for a contract referenced at evaluation
 * time, schema/type registration gap. The root cause is setup even when
 * the symptom surfaces mid-evaluation; fix the configuration to resolve.
 */
export class SELConfigError extends SELStaticError {
	public readonly setting?: string;

	public constructor(
		message: string,
		options?: {
			cause?: unknown;
			setting?: string;
		},
	) {
		super(message, { cause: options?.cause });
		this.setting = options?.setting;
	}
}
