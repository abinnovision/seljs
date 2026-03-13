import {
	TypeError as CelTypeError,
	EvaluationError,
	ParseError,
} from "@marcbachmann/cel-js";

import {
	SELContractError,
	SELEvaluationError,
	SELParseError,
	SELTypeError,
} from "../errors/index.js";

/**
 * Wraps an unknown error into a known SEL error type.
 * - If the error is already a SEL error, it is returned as is.
 * - If the error is a CEL error, it is wrapped into the corresponding SEL error type.
 * - If the error is an unknown type, it is wrapped into a generic Error.
 *
 * @param error The error to wrap.
 * @returns The wrapped error.
 */
export const wrapError = (error: unknown): Error => {
	if (error instanceof SELContractError) {
		return error;
	}

	if (error instanceof ParseError) {
		return new SELParseError(error.message, { cause: error });
	}

	if (error instanceof EvaluationError) {
		const cause = (error as EvaluationError & { cause?: unknown }).cause;
		if (cause instanceof SELContractError) {
			return cause;
		}

		return new SELEvaluationError(error.message, { cause: error });
	}

	if (error instanceof CelTypeError) {
		return new SELTypeError(error.message, { cause: error });
	}

	if (error instanceof Error) {
		return error;
	}

	return new Error(String(error));
};
