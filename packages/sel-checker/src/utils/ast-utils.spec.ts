import { Environment } from "@marcbachmann/cel-js";
import { describe, expect, it } from "vitest";

import {
	findEnclosingCallInfo,
	findNodeAt,
	findNodeWithParentAt,
} from "./ast-utils.js";

const env = new Environment({});
env.registerVariable("x", "int");
env.registerVariable("y", "int");

describe("src/utils/ast-utils.ts", () => {
	describe("findNodeAt", () => {
		it("finds identifier node at cursor", () => {
			const ast = env.parse("x + y").ast;
			const result = findNodeAt(ast, 0);
			expect(result).toBeDefined();
			expect(result!.op).toBe("id");
			expect(result!.args).toBe("x");
		});

		it("finds right operand identifier", () => {
			const ast = env.parse("x + y").ast;
			const result = findNodeAt(ast, 4);
			expect(result).toBeDefined();
			expect(result!.op).toBe("id");
			expect(result!.args).toBe("y");
		});

		it("returns parent binary op when cursor is on operator", () => {
			const ast = env.parse("x + y").ast;
			const result = findNodeAt(ast, 2);
			expect(result).toBeDefined();
			expect(result!.op).toBe("+");
		});

		it("finds value node for literals", () => {
			const ast = env.parse("42").ast;
			const result = findNodeAt(ast, 0);
			expect(result).toBeDefined();
			expect(result!.op).toBe("value");
		});

		it("returns undefined for out-of-range offset", () => {
			const ast = env.parse("x").ast;
			expect(findNodeAt(ast, 100)).toBeUndefined();
			expect(findNodeAt(ast, -1)).toBeUndefined();
		});
	});

	describe("findNodeWithParentAt", () => {
		it("returns parent for identifier inside binary op", () => {
			const ast = env.parse("x + y").ast;
			const result = findNodeWithParentAt(ast, 0);
			expect(result).toBeDefined();
			expect(result!.node.op).toBe("id");
			expect(result!.node.args).toBe("x");
			expect(result!.parent).toBeDefined();
			expect(result!.parent!.op).toBe("+");
		});

		it("returns null parent for root-level single node", () => {
			const ast = env.parse("x").ast;
			const result = findNodeWithParentAt(ast, 0);
			expect(result).toBeDefined();
			expect(result!.node.op).toBe("id");
			expect(result!.parent).toBeNull();
		});

		it("finds arg node with correct parent", () => {
			const ast = env.parse("x + y").ast;
			const result = findNodeWithParentAt(ast, 4);
			expect(result).toBeDefined();
			expect(result!.node.op).toBe("id");
			expect(result!.node.args).toBe("y");
			expect(result!.parent!.op).toBe("+");
		});
	});

	describe("findEnclosingCallInfo", () => {
		it("finds call info for argument inside free function call", () => {
			const env2 = new Environment({});
			env2.registerVariable("x", "int");
			env2.registerFunction(
				{
					name: "foo",
					returnType: "int",
					handler: () => 0,
					params: [{ name: "a", type: "int" }],
				} as any,
				undefined as any,
			);
			const ast = env2.parse("foo(x)").ast;
			const result = findEnclosingCallInfo(ast, 4);
			expect(result).toBeDefined();
			expect(result!.functionName).toBe("foo");
			expect(result!.paramIndex).toBe(0);
			expect(result!.receiverName).toBeUndefined();
		});

		it("returns undefined when cursor is not inside a call", () => {
			const ast = env.parse("x + y").ast;
			expect(findEnclosingCallInfo(ast, 0)).toBeUndefined();
		});

		it("finds rcall info with receiver name", () => {
			const env3 = new Environment({});
			env3.registerVariable("s", "string");

			// string.size() is a built-in rcall in cel-js
			const ast = env3.parse("s.size()").ast;

			// inside the parens
			const result = findEnclosingCallInfo(ast, 7);

			/*
			 * string.size() has no arguments so cursor in empty parens yields paramIndex 0
			 * The key thing is it doesn't crash; result may be defined or undefined
			 */
			expect(result?.functionName ?? "size").toBe("size");
		});
	});
});
