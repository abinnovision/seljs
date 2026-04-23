import { describe, expect, it } from "vitest";

import {
	CircularDependencyError,
	ExecutionLimitError,
	MulticallBatchError,
	SELClientError,
	SELContractError,
	SELError,
	SELEvaluationError,
} from "./errors.js";

type AnyErrorCtor = new (
	message: string,
	options?: Record<string, unknown>,
) => Error;

interface ErrorCase {
	Ctor: AnyErrorCtor;
	name: string;
	extraProps: Record<string, unknown>;
	defaultProps?: Record<string, unknown>;
}

const errorCases: ErrorCase[] = [
	{
		Ctor: SELEvaluationError as AnyErrorCtor,
		name: "SELEvaluationError",
		extraProps: {},
	},
	{
		Ctor: SELContractError as AnyErrorCtor,
		name: "SELContractError",
		extraProps: {
			contractName: "MyContract",
			methodName: "transfer",
			revertReason: "ERC721: owner query for nonexistent token",
			revertData: "0x08c379a0" as `0x${string}`,
			decodedError: { name: "ERC721NonexistentToken", args: [42n] },
		},
	},
	{
		Ctor: CircularDependencyError as AnyErrorCtor,
		name: "CircularDependencyError",
		extraProps: { callIds: ["call-1", "call-2"] },
		defaultProps: { callIds: [] },
	},
	{
		Ctor: ExecutionLimitError as AnyErrorCtor,
		name: "ExecutionLimitError",
		extraProps: { limitType: "maxCalls", limit: 50, actual: 51 },
		defaultProps: { limitType: "maxRounds", limit: 0, actual: 0 },
	},
	{
		Ctor: MulticallBatchError as AnyErrorCtor,
		name: "MulticallBatchError",
		extraProps: {
			failedCallIndex: 2,
			contractName: "MyContract",
			methodName: "transfer",
			revertReason: "ERC721: owner query for nonexistent token",
			revertData: "0x08c379a0" as `0x${string}`,
			decodedError: { name: "ERC721NonexistentToken", args: [42n] },
		},
	},
	{
		Ctor: SELClientError as AnyErrorCtor,
		name: "SELClientError",
		extraProps: {},
	},
];

describe("src/errors/errors.ts", () => {
	for (const { Ctor, name, extraProps, defaultProps } of errorCases) {
		describe(name, () => {
			it("sets message, name and extends Error and SELError", () => {
				const err = new Ctor("test message");
				expect(err).toBeInstanceOf(Error);
				expect(err).toBeInstanceOf(SELError);
				expect(err.message).toBe("test message");
				expect(err.name).toBe(name);
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

	it("distinguishes between error types", () => {
		const contractErr = new SELContractError("contract", {});
		const evalErr = new SELEvaluationError("eval");
		expect(contractErr).toBeInstanceOf(SELContractError);
		expect(contractErr).not.toBeInstanceOf(SELEvaluationError);
		expect(evalErr).toBeInstanceOf(SELEvaluationError);
		expect(evalErr).not.toBeInstanceOf(SELContractError);
	});
});
