import {
	SELError,
	SELEvaluationError,
	SELRuntimeError,
	SELStaticError,
} from "@seljs/common";
import { describe, expect, it } from "vitest";

import {
	SELCircularDependencyError,
	SELClientError,
	SELContractError,
	SELContractRevertError,
	SELExecutionError,
	SELExecutionLimitError,
	SELLintError,
	SELMulticallBatchError,
	SELProviderError,
	SELProviderRpcError,
	SELProviderTransportError,
} from "./errors.js";

type AnyErrorCtor = new (
	message: string,
	options?: Record<string, unknown>,
) => Error;

interface ErrorCase {
	Ctor: AnyErrorCtor;
	name: string;
	parents: readonly (new (...args: never[]) => Error)[];
	extraProps: Record<string, unknown>;
	defaultProps?: Record<string, unknown>;
}

const errorCases: ErrorCase[] = [
	{
		Ctor: SELEvaluationError as AnyErrorCtor,
		name: "SELEvaluationError",
		parents: [SELRuntimeError, SELError, Error],
		extraProps: {},
	},
	{
		Ctor: SELContractError as AnyErrorCtor,
		name: "SELContractError",
		parents: [SELRuntimeError, SELError, Error],
		extraProps: {
			contractName: "MyContract",
			methodName: "transfer",
		},
	},
	{
		Ctor: SELContractRevertError as AnyErrorCtor,
		name: "SELContractRevertError",
		parents: [SELContractError, SELRuntimeError, SELError, Error],
		extraProps: {
			contractName: "MyContract",
			methodName: "transfer",
			revertReason: "ERC721: owner query for nonexistent token",
			revertData: "0x08c379a0" as `0x${string}`,
			decodedError: { name: "ERC721NonexistentToken", args: [42n] },
		},
	},
	{
		Ctor: SELMulticallBatchError as AnyErrorCtor,
		name: "SELMulticallBatchError",
		parents: [SELContractError, SELRuntimeError, SELError, Error],
		extraProps: {
			failedCallIndex: 2,
			contractName: "MyContract",
			methodName: "transfer",
		},
	},
	{
		Ctor: SELCircularDependencyError as AnyErrorCtor,
		name: "SELCircularDependencyError",
		parents: [SELExecutionError, SELRuntimeError, SELError, Error],
		extraProps: { callIds: ["call-1", "call-2"] },
		defaultProps: { callIds: [] },
	},
	{
		Ctor: SELExecutionLimitError as AnyErrorCtor,
		name: "SELExecutionLimitError",
		parents: [SELExecutionError, SELRuntimeError, SELError, Error],
		extraProps: { limitType: "maxCalls", limit: 50, actual: 51 },
		defaultProps: { limitType: "maxRounds", limit: 0, actual: 0 },
	},
	{
		Ctor: SELProviderTransportError as AnyErrorCtor,
		name: "SELProviderTransportError",
		parents: [SELProviderError, SELRuntimeError, SELError, Error],
		extraProps: {
			httpStatus: 503,
			url: "https://rpc.example/mainnet",
			body: "Service Unavailable",
		},
	},
	{
		Ctor: SELProviderRpcError as AnyErrorCtor,
		name: "SELProviderRpcError",
		parents: [SELProviderError, SELRuntimeError, SELError, Error],
		extraProps: {
			rpcCode: -32005,
			rpcData: { retryAfter: 1 },
			method: "eth_call",
		},
	},
	{
		Ctor: SELClientError as AnyErrorCtor,
		name: "SELClientError",
		parents: [SELStaticError, SELError, Error],
		extraProps: {},
	},
];

describe("src/errors/errors.ts", () => {
	for (const { Ctor, name, parents, extraProps, defaultProps } of errorCases) {
		describe(name, () => {
			it("sets message and name", () => {
				const err = new Ctor("test message");
				expect(err.message).toBe("test message");
				expect(err.name).toBe(name);
			});

			it("extends the full inheritance chain", () => {
				const err = new Ctor("test message");
				for (const Parent of parents) {
					expect(err).toBeInstanceOf(Parent);
				}
			});

			it("preserves cause", () => {
				const cause = new Error("root");
				const err = new Ctor("msg", { ...extraProps, cause });
				expect(err.cause).toBe(cause);
			});

			if (Object.keys(extraProps).length > 0) {
				it("exposes domain-specific properties", () => {
					const err = new Ctor("msg", extraProps);
					for (const [key, value] of Object.entries(extraProps)) {
						expect((err as unknown as Record<string, unknown>)[key]).toEqual(
							value,
						);
					}
				});
			}

			if (defaultProps) {
				it("applies default values for domain-specific properties", () => {
					const err = new Ctor("msg");
					for (const [key, value] of Object.entries(defaultProps)) {
						expect((err as unknown as Record<string, unknown>)[key]).toEqual(
							value,
						);
					}
				});
			}
		});
	}

	it("carries diagnostics on SELLintError and extends SELStaticError", () => {
		const diagnostic = {
			rule: "example",
			severity: "error" as const,
			message: "something went wrong",
		};
		const err = new SELLintError([diagnostic]);
		expect(err).toBeInstanceOf(SELLintError);
		expect(err).toBeInstanceOf(SELStaticError);
		expect(err).toBeInstanceOf(SELError);
		expect(err.diagnostics).toEqual([diagnostic]);
		expect(err.message).toContain("something went wrong");
	});

	it("distinguishes between static and runtime branches", () => {
		const staticErr = new SELClientError("client bad");
		const runtimeErr = new SELEvaluationError("eval bad");
		expect(staticErr).toBeInstanceOf(SELStaticError);
		expect(staticErr).not.toBeInstanceOf(SELRuntimeError);
		expect(runtimeErr).toBeInstanceOf(SELRuntimeError);
		expect(runtimeErr).not.toBeInstanceOf(SELStaticError);
	});

	it("catches SELContractRevertError as SELContractError", () => {
		const revert = new SELContractRevertError("reverted", {
			revertReason: "ERC721: …",
		});
		expect(revert).toBeInstanceOf(SELContractError);
		expect(revert.revertReason).toBe("ERC721: …");
	});

	it("catches SELProviderError subclasses via the base", () => {
		const transport = new SELProviderTransportError("http 500", {
			httpStatus: 500,
		});
		const rpc = new SELProviderRpcError("rate limit", { rpcCode: -32005 });
		expect(transport).toBeInstanceOf(SELProviderError);
		expect(rpc).toBeInstanceOf(SELProviderError);
	});
});
