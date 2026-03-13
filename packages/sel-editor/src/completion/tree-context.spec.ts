import { EditorState } from "@codemirror/state";
import { celLanguageSupport } from "@seljs/cel-lezer";
import { describe, expect, it } from "vitest";

import { getCompletionContext } from "./tree-context";

import type { TreeCompletionContext } from "./tree-context";

function ctx(doc: string, pos?: number) {
	const state = EditorState.create({
		doc,
		extensions: [celLanguageSupport()],
	});

	return getCompletionContext(state, pos ?? doc.length);
}

function asDotAccess(result: TreeCompletionContext) {
	expect(result.kind).toBe("dot-access");

	return result as Extract<TreeCompletionContext, { kind: "dot-access" }>;
}

function asCallArg(result: TreeCompletionContext) {
	expect(result.kind).toBe("call-arg");

	return result as Extract<TreeCompletionContext, { kind: "call-arg" }>;
}

describe("src/completion/tree-context.ts", () => {
	describe("getCompletionContext", () => {
		describe("dot-access", () => {
			it("detects dot after simple identifier", () => {
				const result = asDotAccess(ctx("erc20."));
				expect(result.receiverText).toBe("erc20");
				expect(result.from).toBe(6);
			});

			it("detects dot after method call", () => {
				const result = asDotAccess(ctx("erc20.balanceOf()."));
				expect(result.receiverText).toBe("erc20.balanceOf()");
				expect(result.from).toBe(18);
			});

			it("detects dot after chained calls", () => {
				const result = asDotAccess(ctx("erc20.name().toLower()."));
				expect(result.receiverText).toBe("erc20.name().toLower()");
				expect(result.from).toBe(23);
			});

			it("detects partial identifier after dot", () => {
				const result = asDotAccess(ctx("erc20.bal"));
				expect(result.receiverText).toBe("erc20");
				expect(result.from).toBe(6);
			});

			it("handles deep chain with index access", () => {
				const result = asDotAccess(ctx("a.b[0].c."));
				expect(result.receiverText).toBe("a.b[0].c");
			});
		});

		describe("call-arg", () => {
			it("detects first argument position", () => {
				const result = asCallArg(ctx("foo("));
				expect(result.functionName).toBe("foo");
				expect(result.paramIndex).toBe(0);
				expect(result.receiverName).toBeUndefined();
			});

			it("detects second argument after comma", () => {
				const result = asCallArg(ctx("erc20.balanceOf(x, "));
				expect(result.functionName).toBe("balanceOf");
				expect(result.receiverName).toBe("erc20");
				expect(result.paramIndex).toBe(1);
			});

			it("detects method call argument", () => {
				const result = asCallArg(ctx("erc20.balanceOf("));
				expect(result.functionName).toBe("balanceOf");
				expect(result.receiverName).toBe("erc20");
				expect(result.paramIndex).toBe(0);
			});

			it("detects call-arg for plain identifier inside args", () => {
				const result = asCallArg(ctx("erc20.balanceOf(user"));
				expect(result.functionName).toBe("balanceOf");
				expect(result.receiverName).toBe("erc20");
				expect(result.paramIndex).toBe(0);
			});
		});

		describe("dot-access inside call args", () => {
			it("detects dot-access inside call arguments", () => {
				const result = asDotAccess(ctx("erc20.balanceOf(contract."));
				expect(result.receiverText).toBe("contract");
			});

			it("detects dot-access inside nested call", () => {
				const expr = "list.map(x, contract.getReserveData(contract.)";
				const result = asDotAccess(ctx(expr, expr.length - 1));
				expect(result.receiverText).toBe("contract");
			});

			it("detects dot-access with partial identifier inside args", () => {
				const result = asDotAccess(ctx("foo(erc20.bal"));
				expect(result.receiverText).toBe("erc20");
				expect(result.from).toBe(10);
			});
		});

		describe("top-level", () => {
			it("detects empty document", () => {
				expect(ctx("").kind).toBe("top-level");
			});

			it("detects word at document start", () => {
				const result = ctx("erc");
				expect(result.kind).toBe("top-level");
				expect(
					(result as Extract<TreeCompletionContext, { kind: "top-level" }>)
						.from,
				).toBe(0);
			});

			it("detects after binary operator", () => {
				expect(ctx("x + ").kind).toBe("top-level");
			});

			it("detects after logical operator", () => {
				expect(ctx("a && ").kind).toBe("top-level");
			});
		});

		describe("edge cases", () => {
			it("handles numeric dot (not member access)", () => {
				// 3.14 is a float, not member access
				expect(ctx("3.14").kind).toBe("top-level");
			});

			it("handles cursor in middle of expression", () => {
				// At position 6, we're right after "erc20." — dot-access
				expect(ctx("erc20.balanceOf(user)", 6).kind).toBe("dot-access");
			});
		});
	});
});
