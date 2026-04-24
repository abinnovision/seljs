import { describe, expect, it } from "vitest";

import { SELError } from "./base.js";
import { SELConfigError } from "./config.js";
import { SELEvaluationError } from "./evaluation.js";
import { SELParseError } from "./parse.js";
import { SELRuntimeError } from "./runtime-base.js";
import { SELStaticError } from "./static-base.js";
import { SELTypeCheckError } from "./type-check.js";
import { SELTypeConversionError } from "./type-conversion.js";

describe("src/errors/hierarchy", () => {
	describe("intermediate bases", () => {
		it("extends SELError and Error for SELStaticError", () => {
			const err = new SELStaticError("x");
			expect(err).toBeInstanceOf(SELError);
			expect(err).toBeInstanceOf(Error);
			expect(err.name).toBe("SELStaticError");
		});

		it("extends SELError and Error for SELRuntimeError", () => {
			const err = new SELRuntimeError("x");
			expect(err).toBeInstanceOf(SELError);
			expect(err).toBeInstanceOf(Error);
			expect(err.name).toBe("SELRuntimeError");
		});
	});

	describe("static leaves", () => {
		it("carries position on SELParseError and extends SELStaticError", () => {
			const err = new SELParseError("bad syntax", {
				position: { line: 3, column: 5 },
			});
			expect(err).toBeInstanceOf(SELStaticError);
			expect(err).toBeInstanceOf(SELError);
			expect(err.position).toEqual({ line: 3, column: 5 });
		});

		it("extends SELStaticError on SELTypeCheckError", () => {
			const err = new SELTypeCheckError("type mismatch");
			expect(err).toBeInstanceOf(SELStaticError);
			expect(err.name).toBe("SELTypeCheckError");
		});

		it("carries setting on SELConfigError and extends SELStaticError", () => {
			const err = new SELConfigError("bad config", {
				setting: "codecRegistry",
			});
			expect(err).toBeInstanceOf(SELStaticError);
			expect(err.setting).toBe("codecRegistry");
		});
	});

	describe("runtime leaves", () => {
		it("extends SELRuntimeError on SELEvaluationError", () => {
			const err = new SELEvaluationError("eval fail");
			expect(err).toBeInstanceOf(SELRuntimeError);
			expect(err).toBeInstanceOf(SELError);
		});

		it("carries type info on SELTypeConversionError and extends SELRuntimeError", () => {
			const err = new SELTypeConversionError("bad address", {
				expectedType: "sol_address",
				actualValue: "not-hex",
			});
			expect(err).toBeInstanceOf(SELRuntimeError);
			expect(err.expectedType).toBe("sol_address");
			expect(err.actualValue).toBe("not-hex");
		});
	});

	it("keeps static and runtime branches non-overlapping", () => {
		const staticErr = new SELConfigError("x");
		const runtimeErr = new SELEvaluationError("y");
		expect(staticErr).toBeInstanceOf(SELStaticError);
		expect(staticErr).not.toBeInstanceOf(SELRuntimeError);
		expect(runtimeErr).toBeInstanceOf(SELRuntimeError);
		expect(runtimeErr).not.toBeInstanceOf(SELStaticError);
	});
});
