import { describe, expect, it } from "vitest";

import { ERC20_SCHEMA } from "./fixtures.js";
import { SELChecker, rules } from "../../src/index.js";

import type { SELRule } from "../../src/index.js";

const schema = ERC20_SCHEMA;

describe("rule system integration", () => {
	describe("backward compatibility", () => {
		it("produces no rule diagnostics when no rules are configured", () => {
			const checker = new SELChecker(schema);
			const result = checker.check("true && true");

			// Should only have type-checking diagnostics, no rule diagnostics
			expect(result.diagnostics.every((d) => d.severity === "error")).toBe(
				true,
			);
		});

		it("returns valid=true for valid expressions without rules", () => {
			const checker = new SELChecker(schema);
			const result = checker.check("erc20.totalSupply()");
			expect(result.valid).toBe(true);
			expect(result.diagnostics).toHaveLength(0);
		});
	});

	describe("built-in rules", () => {
		it("all built-in rules have required fields", () => {
			for (const rule of rules.builtIn) {
				expect(rule.name).toMatch(/^[a-z][a-z0-9-]+$/);
				expect(rule.description).toBeTruthy();
				expect(["error", "warning", "info"]).toContain(rule.defaultSeverity);
				expect(typeof rule.run).toBe("function");
			}
		});

		it("contains expected rules", () => {
			const names = rules.builtIn.map((r) => r.name);
			expect(names).toContain("no-redundant-bool");
			expect(names).toContain("no-constant-condition");
			expect(names).toContain("no-mixed-operators");
			expect(names).toContain("no-self-comparison");
		});
	});

	describe("no-redundant-bool", () => {
		const checker = new SELChecker(schema, { rules: [...rules.builtIn] });

		it("flags `x == true`", () => {
			const result = checker.check("erc20.totalSupply() > 0 == true");
			const ruleDiags = result.diagnostics.filter((d) =>
				d.message.includes("Redundant"),
			);
			expect(ruleDiags).toHaveLength(1);
			expect(ruleDiags[0]!.message).toContain("`true`");
			expect(ruleDiags[0]!.severity).toBe("warning");
		});

		it("flags `x != false`", () => {
			const result = checker.check("erc20.totalSupply() > 0 != false");
			const ruleDiags = result.diagnostics.filter((d) =>
				d.message.includes("Redundant"),
			);
			expect(ruleDiags).toHaveLength(1);
			expect(ruleDiags[0]!.message).toContain("`false`");
		});

		it("does not flag `x == y`", () => {
			const result = checker.check(
				"erc20.totalSupply() == erc20.totalSupply()",
			);
			const ruleDiags = result.diagnostics.filter((d) =>
				d.message.includes("Redundant"),
			);
			expect(ruleDiags).toHaveLength(0);
		});
	});

	describe("no-constant-condition", () => {
		const checker = new SELChecker(schema, { rules: [...rules.builtIn] });

		it("flags `true && x`", () => {
			const result = checker.check("true && erc20.totalSupply() > 0");
			const ruleDiags = result.diagnostics.filter((d) =>
				d.message.includes("Constant condition"),
			);
			expect(ruleDiags).toHaveLength(1);
			expect(ruleDiags[0]!.message).toContain("left side");
			expect(ruleDiags[0]!.message).toContain("`true`");
		});

		it("flags `x || false`", () => {
			const result = checker.check("erc20.totalSupply() > 0 || false");
			const ruleDiags = result.diagnostics.filter((d) =>
				d.message.includes("Constant condition"),
			);
			expect(ruleDiags).toHaveLength(1);
			expect(ruleDiags[0]!.message).toContain("right side");
		});

		it("flags literal == literal", () => {
			const result = checker.check("1 == 1");
			const ruleDiags = result.diagnostics.filter((d) =>
				d.message.includes("Constant condition"),
			);
			expect(ruleDiags).toHaveLength(1);
			expect(ruleDiags[0]!.message).toContain("literal values");
		});

		it("does not flag variable conditions", () => {
			const result = checker.check(
				"erc20.totalSupply() > 0 && erc20.balanceOf(user) > 0",
			);
			const ruleDiags = result.diagnostics.filter((d) =>
				d.message.includes("Constant condition"),
			);
			expect(ruleDiags).toHaveLength(0);
		});
	});

	describe("no-self-comparison", () => {
		const checker = new SELChecker(schema, { rules: [...rules.builtIn] });

		it("flags `x == x` as always true", () => {
			const result = checker.check(
				"erc20.totalSupply() == erc20.totalSupply()",
			);
			const ruleDiags = result.diagnostics.filter((d) =>
				d.message.includes("identical"),
			);
			expect(ruleDiags).toHaveLength(1);
			expect(ruleDiags[0]!.message).toContain("always `true`");
		});

		it("flags `x != x` as always false", () => {
			const result = checker.check(
				"erc20.totalSupply() != erc20.totalSupply()",
			);
			const ruleDiags = result.diagnostics.filter((d) =>
				d.message.includes("identical"),
			);
			expect(ruleDiags).toHaveLength(1);
			expect(ruleDiags[0]!.message).toContain("always `false`");
		});

		it("does not flag different sides", () => {
			const result = checker.check(
				"erc20.totalSupply() == erc20.balanceOf(user)",
			);
			const ruleDiags = result.diagnostics.filter((d) =>
				d.message.includes("identical"),
			);
			expect(ruleDiags).toHaveLength(0);
		});
	});

	describe("no-mixed-operators", () => {
		const checker = new SELChecker(schema, { rules: [...rules.builtIn] });

		it("flags mixed && and || without parentheses", () => {
			const result = checker.check(
				"erc20.totalSupply() > 0 && erc20.balanceOf(user) > 0 || erc20.decimals() > 0",
			);
			const ruleDiags = result.diagnostics.filter((d) =>
				d.message.includes("Mixed logical"),
			);
			expect(ruleDiags.length).toBeGreaterThanOrEqual(1);
			expect(ruleDiags[0]!.severity).toBe("info");
		});

		it("does not flag when only one operator is used", () => {
			const result = checker.check(
				"erc20.totalSupply() > 0 && erc20.balanceOf(user) > 0 && erc20.decimals() > 0",
			);
			const ruleDiags = result.diagnostics.filter((d) =>
				d.message.includes("Mixed logical"),
			);
			expect(ruleDiags).toHaveLength(0);
		});

		it("does not flag when parentheses are explicit", () => {
			const result = checker.check(
				"erc20.totalSupply() > 0 && (erc20.balanceOf(user) > 0 || erc20.decimals() > 0)",
			);
			const ruleDiags = result.diagnostics.filter((d) =>
				d.message.includes("Mixed logical"),
			);
			expect(ruleDiags).toHaveLength(0);
		});
	});

	describe("error-severity rules affect validity", () => {
		it("keeps valid=true when rules only report warnings", () => {
			const checker = new SELChecker(schema, {
				rules: [...rules.builtIn],
			});

			// self-comparison defaults to warning
			const result = checker.check(
				"erc20.totalSupply() == erc20.totalSupply()",
			);
			expect(result.valid).toBe(true);
			expect(result.diagnostics.length).toBeGreaterThan(0);
		});
	});

	describe("diagnostics have positions", () => {
		it("reports from/to positions for rule diagnostics", () => {
			const checker = new SELChecker(schema, {
				rules: [...rules.builtIn],
			});
			const result = checker.check("erc20.totalSupply() > 0 == true");
			const ruleDiags = result.diagnostics.filter((d) =>
				d.message.includes("Redundant"),
			);
			expect(ruleDiags).toHaveLength(1);
			expect(ruleDiags[0]!.from).toBeDefined();
			expect(ruleDiags[0]!.to).toBeDefined();
			expect(typeof ruleDiags[0]!.from).toBe("number");
			expect(typeof ruleDiags[0]!.to).toBe("number");
		});
	});

	describe("structural rules run even on type-check failure", () => {
		it("reports structural rule diagnostics alongside type errors", () => {
			const checker = new SELChecker(schema, {
				rules: [...rules.builtIn],
			});

			// unknownVar won't type-check, but `true &&` is a structural constant-condition
			const result = checker.check("true && unknownVar");
			expect(result.valid).toBe(false);

			const typeErrors = result.diagnostics.filter(
				(d) =>
					d.severity === "error" && !d.message.includes("Constant condition"),
			);
			const ruleWarnings = result.diagnostics.filter((d) =>
				d.message.includes("Constant condition"),
			);

			expect(typeErrors.length).toBeGreaterThan(0);
			expect(ruleWarnings).toHaveLength(1);
		});
	});

	describe("require-type rule factory", () => {
		it("passes when expression evaluates to expected type", () => {
			const checker = new SELChecker(schema, {
				rules: [rules.requireType("bool")],
			});
			const result = checker.check("erc20.totalSupply() > 0");
			const diags = result.diagnostics.filter((d) =>
				d.message.includes("Expected expression"),
			);
			expect(diags).toHaveLength(0);
			expect(result.valid).toBe(true);
		});

		it("reports error when expression evaluates to wrong type", () => {
			const checker = new SELChecker(schema, {
				rules: [rules.requireType("bool")],
			});
			const result = checker.check("erc20.totalSupply()");
			const diags = result.diagnostics.filter((d) =>
				d.message.includes("Expected expression"),
			);
			expect(diags).toHaveLength(1);
			expect(diags[0]!.message).toContain('"bool"');
			expect(diags[0]!.severity).toBe("error");
			expect(result.valid).toBe(false);
		});

		it("spans the full expression in the diagnostic", () => {
			const expr = "erc20.totalSupply()";
			const checker = new SELChecker(schema, {
				rules: [rules.requireType("bool")],
			});
			const result = checker.check(expr);
			const diag = result.diagnostics.find((d) =>
				d.message.includes("Expected expression"),
			);
			expect(diag!.from).toBe(0);
			expect(diag!.to).toBe(expr.length);
		});

		it("works with non-bool expected types", () => {
			const checker = new SELChecker(schema, {
				rules: [rules.requireType("sol_int")],
			});
			const result = checker.check("erc20.totalSupply() > 0");
			const diags = result.diagnostics.filter((d) =>
				d.message.includes("Expected expression"),
			);
			expect(diags).toHaveLength(1);
			expect(diags[0]!.message).toContain('"sol_int"');
		});

		it("does not run on type-check failure (type-aware tier)", () => {
			const checker = new SELChecker(schema, {
				rules: [rules.requireType("bool")],
			});
			const result = checker.check("unknownVar");
			const diags = result.diagnostics.filter((d) =>
				d.message.includes("Expected expression"),
			);
			expect(diags).toHaveLength(0);
		});
	});

	describe("custom rules", () => {
		it("supports user-provided rules", () => {
			let ruleWasCalled = false;
			const customRule: SELRule = {
				name: "test-custom",
				description: "Test rule.",
				defaultSeverity: "info",
				tier: "structural",
				run(ctx) {
					ruleWasCalled = true;

					return [ctx.reportAt(0, 1, "Custom diagnostic")];
				},
			};

			const checker = new SELChecker(schema, {
				rules: [customRule],
			});
			const result = checker.check("erc20.totalSupply()");
			expect(ruleWasCalled).toBe(true);
			expect(result.diagnostics).toHaveLength(1);
			expect(result.diagnostics[0]!.message).toBe("Custom diagnostic");
			expect(result.diagnostics[0]!.severity).toBe("info");
		});
	});
});
