import {
	TypeError as CelTypeError,
	EvaluationError,
	ParseError,
} from "@marcbachmann/cel-js";
import { describe, expect, it } from "vitest";

import { wrapError } from "./error-wrapper.js";
import {
	SELContractError,
	SELEvaluationError,
	SELParseError,
	SELTypeError,
} from "../errors/index.js";

describe("src/environment/error-wrapper.ts", () => {
	it("returns SELContractError as-is", () => {
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

	it("returns cause directly when EvaluationError wraps SELContractError", () => {
		const contractErr = new SELContractError("inner", {
			contractName: "vault",
		});
		const evalErr = new (EvaluationError as new (
			...args: unknown[]
		) => EvaluationError)("eval fail", undefined, contractErr);
		const result = wrapError(evalErr);
		expect(result).toBe(contractErr);
	});

	it("wraps EvaluationError with non-SELContractError cause as SELEvaluationError", () => {
		const cause = new Error("generic");
		const evalErr = new (EvaluationError as new (
			...args: unknown[]
		) => EvaluationError)("eval fail", undefined, cause);
		const result = wrapError(evalErr);
		expect(result).toBeInstanceOf(SELEvaluationError);
		expect(result.message).toBe("eval fail");
		expect(result.cause).toBe(evalErr);
	});

	it("wraps EvaluationError without cause as SELEvaluationError", () => {
		const evalErr = new EvaluationError("eval fail");
		const result = wrapError(evalErr);
		expect(result).toBeInstanceOf(SELEvaluationError);
	});

	it("wraps CelTypeError as SELTypeError", () => {
		const err = new CelTypeError("type mismatch");
		const result = wrapError(err);
		expect(result).toBeInstanceOf(SELTypeError);
		expect(result.message).toBe("type mismatch");
		expect(result.cause).toBe(err);
	});

	it("returns generic Error as-is", () => {
		const err = new Error("something went wrong");
		expect(wrapError(err)).toBe(err);
	});

	it("wraps non-Error value in new Error", () => {
		const result = wrapError("string error");
		expect(result).toBeInstanceOf(Error);
		expect(result.message).toBe("string error");
	});

	it("wraps numeric non-Error value in new Error", () => {
		const result = wrapError(42);
		expect(result).toBeInstanceOf(Error);
		expect(result.message).toBe("42");
	});
});
