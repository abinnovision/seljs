import {
	TypeError as CelTypeError,
	EvaluationError,
	ParseError,
} from "@marcbachmann/cel-js";
import {
	SELError,
	SELEvaluationError,
	SELParseError,
	SELTypeCheckError,
} from "@seljs/common";
import {
	AbiDecodingDataSizeInvalidError,
	AbiDecodingZeroDataError,
	AbiErrorSignatureNotFoundError,
	BaseError as ViemBaseError,
	ContractFunctionExecutionError,
	ContractFunctionRevertedError,
	HttpRequestError,
	RpcError,
	TimeoutError,
	WebSocketRequestError,
} from "viem";

import {
	SELContractError,
	SELContractRevertError,
	SELProviderError,
	SELProviderRpcError,
	SELProviderTransportError,
} from "../errors/index.js";

/**
 * Compose a human-readable message from a viem error. Uses `shortMessage`
 * when present and appends any `metaMessages` lines so context like the
 * contract address, function call, and chain is not lost.
 */
const extractViemMessage = (error: ViemBaseError): string => {
	const shortMessage = error.shortMessage || error.message;
	const meta = error.metaMessages;
	if (!meta || meta.length === 0) {
		return shortMessage;
	}

	return `${shortMessage}\n${meta.join("\n")}`;
};

const wrapContractRevert = (
	error: ContractFunctionRevertedError,
): SELContractRevertError => {
	const decoded = error.data
		? { name: error.data.errorName, args: error.data.args ?? [] }
		: undefined;

	return new SELContractRevertError(extractViemMessage(error), {
		cause: error,
		revertReason: error.reason,
		revertData: error.raw,
		decodedError: decoded,
	});
};

const wrapViemError = (error: ViemBaseError): SELError => {
	// A provider/transport error may wrap an inner revert. Unwrap first.
	const nestedRevert = error.walk(
		(e): e is ContractFunctionRevertedError =>
			e instanceof ContractFunctionRevertedError,
	);
	if (nestedRevert) {
		return wrapContractRevert(nestedRevert as ContractFunctionRevertedError);
	}

	if (error instanceof ContractFunctionRevertedError) {
		return wrapContractRevert(error);
	}

	if (error instanceof ContractFunctionExecutionError) {
		return new SELContractError(extractViemMessage(error), {
			cause: error,
			contractName: error.contractAddress,
			methodName: error.functionName,
		});
	}

	if (
		error instanceof AbiDecodingDataSizeInvalidError ||
		error instanceof AbiDecodingZeroDataError ||
		error instanceof AbiErrorSignatureNotFoundError
	) {
		return new SELContractError(extractViemMessage(error), { cause: error });
	}

	if (error instanceof HttpRequestError) {
		return new SELProviderTransportError(extractViemMessage(error), {
			cause: error,
			httpStatus: error.status,
			url: error.url,
			body:
				typeof error.body === "string"
					? error.body
					: error.body !== undefined
						? JSON.stringify(error.body)
						: undefined,
		});
	}

	if (error instanceof TimeoutError || error instanceof WebSocketRequestError) {
		return new SELProviderTransportError(extractViemMessage(error), {
			cause: error,
			url: error instanceof WebSocketRequestError ? error.url : undefined,
		});
	}

	if (error instanceof RpcError) {
		const rpc: { code?: number; data?: unknown } = error;

		return new SELProviderRpcError(extractViemMessage(error), {
			cause: error,
			rpcCode: rpc.code,
			rpcData: rpc.data,
		});
	}

	return new SELProviderError(extractViemMessage(error), { cause: error });
};

/**
 * Wraps an unknown error into a known SEL error type.
 *
 * - A `SELError` is returned as-is.
 * - cel-js errors (`ParseError`, `TypeError`, `EvaluationError`) become the
 *   matching `SEL*Error` and preserve `cause`.
 * - viem errors are routed by concrete class: reverts → `SELContractRevertError`,
 *   transport/timeout → `SELProviderTransportError`, JSON-RPC → `SELProviderRpcError`,
 *   contract execution / ABI decode → `SELContractError`, everything else → `SELProviderError`.
 * - Any other `Error` becomes `SELEvaluationError` with the original as `cause`.
 */
export const wrapError = (error: unknown): SELError => {
	if (error instanceof SELError) {
		return error;
	}

	if (error instanceof EvaluationError) {
		const cause = (error as EvaluationError & { cause?: unknown }).cause;
		if (cause instanceof SELError) {
			return cause;
		}

		if (cause instanceof ViemBaseError) {
			return wrapViemError(cause);
		}

		return new SELEvaluationError(error.message, { cause: error });
	}

	if (error instanceof ParseError) {
		return new SELParseError(error.message, { cause: error });
	}

	if (error instanceof CelTypeError) {
		return new SELTypeCheckError(error.message, { cause: error });
	}

	if (error instanceof ViemBaseError) {
		return wrapViemError(error);
	}

	if (error instanceof Error) {
		return new SELEvaluationError(error.message, { cause: error });
	}

	return new SELEvaluationError(String(error));
};
