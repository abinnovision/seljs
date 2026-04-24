import {
	TypeError as CelTypeError,
	EvaluationError,
	ParseError,
} from "@marcbachmann/cel-js";
import {
	SELEvaluationError,
	SELParseError,
	SELTypeCheckError,
} from "@seljs/common";
import {
	AbiDecodingDataSizeInvalidError,
	AbiErrorSignatureNotFoundError,
	BaseError as ViemBaseError,
	ContractFunctionExecutionError,
	ContractFunctionRevertedError,
	HttpRequestError,
	RpcError,
	TimeoutError,
} from "viem";
import { describe, expect, it } from "vitest";

import { wrapError } from "./error-wrapper.js";
import {
	SELContractError,
	SELContractRevertError,
	SELProviderError,
	SELProviderRpcError,
	SELProviderTransportError,
} from "../errors/index.js";

describe("src/environment/error-wrapper.ts", () => {
	describe("cel-js errors", () => {
		it("returns SELError as-is", () => {
			const err = new SELContractError("contract fail", {
				contractName: "erc20",
			});
			expect(wrapError(err)).toBe(err);
		});

		it("wraps ParseError as SELParseError", () => {
			const err = new ParseError("bad syntax");
			const result = wrapError(err);
			expect(result).toBeInstanceOf(SELParseError);
			expect(result.message).toBe("bad syntax");
			expect(result.cause).toBe(err);
		});

		it("wraps CelTypeError as SELTypeCheckError", () => {
			const err = new CelTypeError("type mismatch");
			const result = wrapError(err);
			expect(result).toBeInstanceOf(SELTypeCheckError);
			expect(result.message).toBe("type mismatch");
			expect(result.cause).toBe(err);
		});

		it("unwraps EvaluationError to SELError cause", () => {
			const contractErr = new SELContractError("inner", {
				contractName: "vault",
			});
			const evalErr = new (EvaluationError as new (
				...args: unknown[]
			) => EvaluationError)("eval fail", undefined, contractErr);
			expect(wrapError(evalErr)).toBe(contractErr);
		});

		it("wraps EvaluationError with non-SEL cause as SELEvaluationError", () => {
			const cause = new Error("generic");
			const evalErr = new (EvaluationError as new (
				...args: unknown[]
			) => EvaluationError)("eval fail", undefined, cause);
			const result = wrapError(evalErr);
			expect(result).toBeInstanceOf(SELEvaluationError);
			expect(result.cause).toBe(evalErr);
		});

		it("wraps EvaluationError without cause as SELEvaluationError", () => {
			const evalErr = new EvaluationError("eval fail");
			expect(wrapError(evalErr)).toBeInstanceOf(SELEvaluationError);
		});

		it("routes EvaluationError viem-cause through the viem branch", () => {
			const viemErr = new HttpRequestError({
				url: "https://rpc.example",
				status: 500,
				body: { method: "eth_call" },
			});
			const evalErr = new (EvaluationError as new (
				...args: unknown[]
			) => EvaluationError)("eval fail", undefined, viemErr);
			const result = wrapError(evalErr);
			expect(result).toBeInstanceOf(SELProviderTransportError);
			expect((result as SELProviderTransportError).httpStatus).toBe(500);
		});
	});

	describe("viem errors", () => {
		it("wraps ContractFunctionRevertedError as SELContractRevertError", () => {
			const revert = new ContractFunctionRevertedError({
				abi: [],
				data: "0x08c379a0" as `0x${string}`,
				functionName: "transfer",
			});
			const result = wrapError(revert);
			expect(result).toBeInstanceOf(SELContractRevertError);
			expect(result.cause).toBe(revert);
		});

		it("wraps ContractFunctionExecutionError as SELContractError", () => {
			const exec = new ContractFunctionExecutionError(new ViemBaseError("x"), {
				abi: [],
				functionName: "transfer",
				contractAddress: "0x1234",
			});
			const result = wrapError(exec);
			expect(result).toBeInstanceOf(SELContractError);
			expect(result).not.toBeInstanceOf(SELContractRevertError);
		});

		it("wraps AbiDecodingDataSizeInvalidError as SELContractError", () => {
			const err = new AbiDecodingDataSizeInvalidError({
				data: "0x00" as `0x${string}`,
				size: 1,
			});
			expect(wrapError(err)).toBeInstanceOf(SELContractError);
		});

		it("wraps AbiErrorSignatureNotFoundError as SELContractError", () => {
			const err = new AbiErrorSignatureNotFoundError("0xdeadbeef", {
				docsPath: "",
			});
			expect(wrapError(err)).toBeInstanceOf(SELContractError);
		});

		it("wraps HttpRequestError as SELProviderTransportError with status/url/body", () => {
			const err = new HttpRequestError({
				url: "https://rpc.example/mainnet",
				status: 503,
				body: { method: "eth_call" },
			});
			const result = wrapError(err);
			expect(result).toBeInstanceOf(SELProviderTransportError);
			const transport = result as SELProviderTransportError;
			expect(transport.httpStatus).toBe(503);
			expect(transport.url).toBe("https://rpc.example/mainnet");
			expect(typeof transport.body).toBe("string");
			expect(transport.cause).toBe(err);
		});

		it("wraps TimeoutError as SELProviderTransportError", () => {
			const err = new TimeoutError({ body: {}, url: "https://rpc.example" });
			const result = wrapError(err);
			expect(result).toBeInstanceOf(SELProviderTransportError);
			expect((result as SELProviderTransportError).httpStatus).toBeUndefined();
		});

		it("wraps RpcError as SELProviderRpcError with code/data", () => {
			class TestRpcError extends RpcError {
				public override readonly code = -32005;
			}
			const err = new TestRpcError(new Error("rate limit"), {
				shortMessage: "rate limit",
			});
			const result = wrapError(err);
			expect(result).toBeInstanceOf(SELProviderRpcError);
			expect((result as SELProviderRpcError).rpcCode).toBe(-32005);
		});

		it("wraps a generic viem BaseError as SELProviderError catch-all", () => {
			const err = new ViemBaseError("some viem failure");
			const result = wrapError(err);
			expect(result).toBeInstanceOf(SELProviderError);
			expect(result).not.toBeInstanceOf(SELProviderTransportError);
			expect(result).not.toBeInstanceOf(SELProviderRpcError);
			expect(result).not.toBeInstanceOf(SELContractError);
		});

		it("walks into nested ContractFunctionRevertedError through a transport error", () => {
			const revert = new ContractFunctionRevertedError({
				abi: [],
				data: "0x08c379a0" as `0x${string}`,
				functionName: "transfer",
			});
			const outer = new ContractFunctionExecutionError(revert, {
				abi: [],
				functionName: "transfer",
				contractAddress: "0x1234",
			});
			const result = wrapError(outer);
			expect(result).toBeInstanceOf(SELContractRevertError);
		});

		it("preserves viem shortMessage in the wrapped message", () => {
			const err = new HttpRequestError({
				url: "https://rpc.example",
				status: 500,
			});
			const result = wrapError(err);
			expect(result.message).toContain(err.shortMessage);
		});
	});

	describe("fallback branches", () => {
		it("wraps a generic Error as SELEvaluationError with cause", () => {
			const err = new Error("something went wrong");
			const result = wrapError(err);
			expect(result).toBeInstanceOf(SELEvaluationError);
			expect(result.cause).toBe(err);
		});

		it("wraps a string value as SELEvaluationError", () => {
			const result = wrapError("string error");
			expect(result).toBeInstanceOf(SELEvaluationError);
			expect(result.message).toBe("string error");
		});

		it("wraps a numeric value as SELEvaluationError", () => {
			const result = wrapError(42);
			expect(result).toBeInstanceOf(SELEvaluationError);
			expect(result.message).toBe("42");
		});
	});
});
