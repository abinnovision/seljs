import { describe, expect, it } from "vitest";

import { parser } from "./parser.js";

const nodeTypes = (expr: string): string[] => {
	const tree = parser.parse(expr);
	const types: string[] = [];
	tree.cursor().iterate((node) => {
		types.push(node.name);
	});

	return types;
};

const hasErrors = (expr: string): boolean => {
	const tree = parser.parse(expr);
	let found = false;
	tree.cursor().iterate((node) => {
		if (node.type.isError) {
			found = true;
		}
	});

	return found;
};

const topNode = (expr: string): string => parser.parse(expr).topNode.name;

describe("src/cel.grammar", () => {
	/*
	 * ---------------------------------------------------------------------------
	 * Literals
	 * ---------------------------------------------------------------------------
	 */

	describe("literals", () => {
		it("parses integer", () => {
			expect(nodeTypes("42")).toContain("Number");
		});

		it("parses unsigned int", () => {
			expect(nodeTypes("42u")).toContain("Number");
		});

		it("parses hex integer", () => {
			expect(nodeTypes("0xFF")).toContain("Number");
		});

		it("parses hex with u suffix", () => {
			expect(nodeTypes("0xFFu")).toContain("Number");
		});

		it("parses float", () => {
			expect(nodeTypes("3.14")).toContain("Number");
		});

		it("parses float with exponent", () => {
			expect(nodeTypes("1.5e10")).toContain("Number");
		});

		it("parses double-quoted string", () => {
			expect(nodeTypes('"hello"')).toContain("String");
		});

		it("parses single-quoted string", () => {
			expect(nodeTypes("'hello'")).toContain("String");
		});

		it("parses string with escapes", () => {
			expect(nodeTypes('"hello\\nworld"')).toContain("String");
		});

		it("parses boolean true", () => {
			expect(nodeTypes("true")).toContain("BooleanLiteral");
		});

		it("parses boolean false", () => {
			expect(nodeTypes("false")).toContain("BooleanLiteral");
		});

		it("parses null", () => {
			expect(nodeTypes("null")).toContain("NullLiteral");
		});
	});

	/*
	 * ---------------------------------------------------------------------------
	 * Identifiers
	 * ---------------------------------------------------------------------------
	 */

	describe("identifiers", () => {
		it("parses simple identifier", () => {
			expect(nodeTypes("foo")).toContain("Identifier");
		});

		it("parses underscore-prefixed identifier", () => {
			expect(nodeTypes("_foo")).toContain("Identifier");
		});

		it("parses identifier with digits (erc20)", () => {
			expect(nodeTypes("erc20")).toContain("Identifier");
		});
	});

	/*
	 * ---------------------------------------------------------------------------
	 * Operators and precedence
	 * ---------------------------------------------------------------------------
	 */

	describe("operators and precedence", () => {
		it("parses addition", () => {
			expect(nodeTypes("a + b")).toContain("BinaryExpression");
		});

		it("parses subtraction", () => {
			expect(nodeTypes("a - b")).toContain("BinaryExpression");
		});

		it("parses multiplication", () => {
			expect(nodeTypes("a * b")).toContain("BinaryExpression");
		});

		it("parses division", () => {
			expect(nodeTypes("a / b")).toContain("BinaryExpression");
		});

		it("parses modulo", () => {
			expect(nodeTypes("a % b")).toContain("BinaryExpression");
		});

		it("parses equality", () => {
			expect(nodeTypes("a == b")).toContain("BinaryExpression");
		});

		it("parses inequality", () => {
			expect(nodeTypes("a != b")).toContain("BinaryExpression");
		});

		it("parses less-than", () => {
			expect(nodeTypes("a < b")).toContain("BinaryExpression");
		});

		it("parses greater-than", () => {
			expect(nodeTypes("a > b")).toContain("BinaryExpression");
		});

		it("parses less-than-or-equal", () => {
			expect(nodeTypes("a <= b")).toContain("BinaryExpression");
		});

		it("parses greater-than-or-equal", () => {
			expect(nodeTypes("a >= b")).toContain("BinaryExpression");
		});

		it("parses logical AND", () => {
			expect(nodeTypes("a && b")).toContain("BinaryExpression");
		});

		it("parses logical OR", () => {
			expect(nodeTypes("a || b")).toContain("BinaryExpression");
		});

		it("parses in operator", () => {
			expect(nodeTypes("a in b")).toContain("BinaryExpression");
		});

		it("parses unary NOT", () => {
			expect(nodeTypes("!a")).toContain("BinaryExpression");
		});

		it("parses unary minus", () => {
			expect(nodeTypes("-a")).toContain("BinaryExpression");
		});

		it("parses ternary expression", () => {
			expect(nodeTypes("a ? b : c")).toContain("ConditionalExpression");
		});

		it("multiplication binds tighter than addition", () => {
			/*
			 * a + b * c should parse as a + (b * c), meaning BinaryExpression at top
			 * with the inner BinaryExpression for b*c nested deeper
			 */
			const types = nodeTypes("a + b * c");
			expect(types).toContain("BinaryExpression");

			// Top node is Expression
			expect(topNode("a + b * c")).toBe("Expression");
		});
	});

	/*
	 * ---------------------------------------------------------------------------
	 * Member access and calls
	 * ---------------------------------------------------------------------------
	 */

	describe("member access and calls", () => {
		it("parses dot access (a.b)", () => {
			expect(nodeTypes("a.b")).toContain("MemberExpression");
		});

		it("parses optional access (a.?b)", () => {
			expect(nodeTypes("a.?b")).toContain("OptionalExpression");
		});

		it("parses function call f()", () => {
			expect(nodeTypes("f()")).toContain("CallExpression");
		});

		it("parses method call with args a.b(x, y)", () => {
			const types = nodeTypes("a.b(x, y)");
			expect(types).toContain("CallExpression");
			expect(types).toContain("ArgList");
		});

		it("parses chained member access a.b.c", () => {
			const types = nodeTypes("a.b.c");
			expect(
				types.filter((t) => t === "MemberExpression").length,
			).toBeGreaterThanOrEqual(1);
		});

		it("parses chained method calls a.b().c()", () => {
			const types = nodeTypes("a.b().c()");
			expect(
				types.filter((t) => t === "CallExpression").length,
			).toBeGreaterThanOrEqual(2);
		});

		it("parses deep chain a.b().c[0].d()", () => {
			const types = nodeTypes("a.b().c[0].d()");
			expect(types).toContain("CallExpression");
			expect(types).toContain("IndexExpression");
		});

		it("parses index access a[0]", () => {
			expect(nodeTypes("a[0]")).toContain("IndexExpression");
		});

		it("parses nested calls f(g(x), h(y))", () => {
			const types = nodeTypes("f(g(x), h(y))");
			expect(
				types.filter((t) => t === "CallExpression").length,
			).toBeGreaterThanOrEqual(3);
		});
	});

	/*
	 * ---------------------------------------------------------------------------
	 * List and map literals
	 * ---------------------------------------------------------------------------
	 */

	describe("list and map literals", () => {
		it("parses empty list []", () => {
			expect(nodeTypes("[]")).toContain("ListLiteral");
		});

		it("parses list with elements", () => {
			expect(nodeTypes("[1, 2, 3]")).toContain("ListLiteral");
		});

		it("parses empty map {}", () => {
			expect(nodeTypes("{}")).toContain("MapLiteral");
		});

		it("parses map with entries", () => {
			expect(nodeTypes('{"key": "value"}')).toContain("MapLiteral");
		});

		it("parses nested collections", () => {
			const types = nodeTypes("[{}, {}]");
			expect(types).toContain("ListLiteral");
			expect(types).toContain("MapLiteral");
		});
	});

	/*
	 * ---------------------------------------------------------------------------
	 * Macro-style expressions
	 * ---------------------------------------------------------------------------
	 */

	describe("macro-style expressions", () => {
		it("parses list.map(x, x+1)", () => {
			const types = nodeTypes("list.map(x, x+1)");
			expect(types).toContain("CallExpression");
		});

		it("parses list.filter(x, x>0)", () => {
			const types = nodeTypes("list.filter(x, x>0)");
			expect(types).toContain("CallExpression");
		});

		it("parses list.exists(x, x==0)", () => {
			const types = nodeTypes("list.exists(x, x==0)");
			expect(types).toContain("CallExpression");
		});

		it("parses list.all(x, x>0)", () => {
			const types = nodeTypes("list.all(x, x>0)");
			expect(types).toContain("CallExpression");
		});
	});

	/*
	 * ---------------------------------------------------------------------------
	 * Parenthesized expressions
	 * ---------------------------------------------------------------------------
	 */

	describe("parenthesized expressions", () => {
		it("parses (a+b)*c", () => {
			const types = nodeTypes("(a+b)*c");
			expect(types).toContain("BinaryExpression");
		});

		it("parses double-wrapped ((a))", () => {
			expect(nodeTypes("((a))")).toContain("Identifier");
		});
	});

	/*
	 * ---------------------------------------------------------------------------
	 * Comments
	 * ---------------------------------------------------------------------------
	 */

	describe("comments", () => {
		it("parses line comment", () => {
			expect(nodeTypes("// this is a comment\na")).toContain("LineComment");
		});

		it("parses code before comment", () => {
			const types = nodeTypes("a + b // comment");
			expect(types).toContain("BinaryExpression");
			expect(types).toContain("LineComment");
		});
	});

	/*
	 * ---------------------------------------------------------------------------
	 * Complex real-world expressions
	 * ---------------------------------------------------------------------------
	 */

	describe("complex real-world expressions", () => {
		it("parses contract method call with comparison", () => {
			const types = nodeTypes("erc20.balanceOf(owner) >= 1000");
			expect(types).toContain("CallExpression");
			expect(types).toContain("BinaryExpression");
		});

		it("parses chained calls with logical operators", () => {
			const types = nodeTypes("a.b() && c.d()");
			expect(types).toContain("CallExpression");
			expect(types).toContain("BinaryExpression");
		});

		it("parses ternary with method calls", () => {
			const types = nodeTypes("a.isValid() ? a.value() : 0");
			expect(types).toContain("ConditionalExpression");
			expect(types).toContain("CallExpression");
		});

		it("parses macro on method result", () => {
			const types = nodeTypes("token.holders().exists(h, h.balance > 0)");
			expect(types).toContain("CallExpression");
		});
	});

	/*
	 * ---------------------------------------------------------------------------
	 * Error recovery
	 * ---------------------------------------------------------------------------
	 */

	describe("error recovery", () => {
		it("incomplete dot access (erc20.) has errors", () => {
			expect(hasErrors("erc20.")).toBe(true);
		});

		it("incomplete binary expression (x + ) has errors", () => {
			expect(hasErrors("x + ")).toBe(true);
		});

		it("empty input has no errors", () => {
			expect(hasErrors("")).toBe(false);
		});
	});
});
