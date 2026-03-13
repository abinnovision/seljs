import { contractTypeName } from "@seljs/common";

import { extractDiagnostics } from "./diagnostics.js";
import { expectedTypeForOperator } from "./type-compatibility.js";
import { createCheckerEnvironment } from "../environment/hydrate.js";
import { runRules } from "../rules/index.js";
import { findNodeWithParentAt, nodeSpan, walkAST } from "../utils/index.js";

import type { SELRule } from "../rules/index.js";
import type {
	ASTNode,
	Environment,
	ParseResult,
	TypeCheckResult,
} from "@marcbachmann/cel-js";
import type { SELSchema, TypeSchema } from "@seljs/schema";

interface SELCheckResult {
	valid: boolean;
	type?: string;
	diagnostics: SELDiagnostic[];
}

interface TypeAtResult {
	type: string;
	from: number;
	to: number;
}

interface ExpectedTypeInfo {
	/**
	 * The CEL type expected at this position.
	 */
	expectedType: string;

	/**
	 * How the expectation was inferred.
	 */
	context: "operator" | "function-argument";

	/**
	 * For function args: which parameter index.
	 */
	paramIndex?: number;

	/**
	 * For function args: the function/method name.
	 */
	functionName?: string;
}

interface CompletionInfo {
	kind: "top-level" | "dot-access" | "explicit";
	receiverType?: string;
	items: CompletionItem[];

	/**
	 * Inferred expected type at cursor, if determinable.
	 */
	expectedType?: string;
}

export interface CompletionItem {
	label: string;
	type: string;
	detail?: string;
	description?: string;
}

/**
 * A diagnostic message with optional position info. Used for both parse/type errors
 * and rule violations. Positions are optional because some errors (e.g. from cel-js)
 * may not include reliable spans, and rules may choose to report non-positional issues.
 */
export interface SELDiagnostic {
	message: string;
	severity: "error" | "warning" | "info";
	from?: number;
	to?: number;
}

/**
 * Options for configuring the SELChecker.
 */
export interface SELCheckerOptions {
	/**
	 * Lint rules to enable. Defaults to none (backward compatible).
	 */
	rules?: readonly SELRule[];
}

/**
 * SEL expression checker.
 *
 * Wraps a hydrated cel-js Environment built from a SELSchema and exposes
 * parse/type-check, type inference, cursor-position type lookups, and
 * type-aware completions.
 */
export class SELChecker {
	private readonly rules: readonly SELRule[];
	private env: Environment;
	private schema: SELSchema;
	private structTypeMap: Map<string, TypeSchema>;

	public constructor(schema: SELSchema, options?: SELCheckerOptions) {
		this.schema = schema;
		this.env = createCheckerEnvironment(schema);
		this.rules = options?.rules ?? [];
		this.structTypeMap = this.buildStructTypeMap(schema);
	}

	/**
	 * Parse and type-check an expression, returning position-aware diagnostics.
	 *
	 * Uses a single `env.parse()` call, then `.check()` on the result
	 * to avoid double-parsing. Rules run against the AST from the same parse:
	 * - Structural rules run after successful parse (even if type-check fails)
	 * - Type-aware rules run only after both parse and type-check succeed
	 */
	public check(expression: string): SELCheckResult {
		let parsed: ParseResult;
		try {
			parsed = this.env.parse(expression);
		} catch (error) {
			// Parse error — no AST available, no rules can run
			return {
				valid: false,
				diagnostics: extractDiagnostics(expression, error),
			};
		}

		// Run structural rules (these run regardless of type-check result)
		const structuralDiags =
			this.rules.length > 0
				? runRules({
						expression,
						ast: parsed.ast,
						schema: this.schema,
						rules: this.rules,
						tier: "structural",
					})
				: [];

		// Type-check using the same parse result (no second parse)
		let typeResult: TypeCheckResult;
		try {
			typeResult = parsed.check();
		} catch (error) {
			return {
				valid: false,
				diagnostics: [
					...extractDiagnostics(expression, error),
					...structuralDiags,
				],
			};
		}

		if (!typeResult.valid) {
			const typeDiags = typeResult.error
				? extractDiagnostics(expression, typeResult.error)
				: [
						{
							message: "Type check failed",
							severity: "error" as const,
							from: 0,
							to: expression.length,
						},
					];

			return {
				valid: false,
				diagnostics: [...typeDiags, ...structuralDiags],
			};
		}

		// Run type-aware rules (only on fully valid expressions)
		const typeAwareDiags =
			this.rules.length > 0
				? runRules({
						expression,
						ast: parsed.ast,
						schema: this.schema,
						rules: this.rules,
						tier: "type-aware",
						resolvedType: typeResult.type,
					})
				: [];

		const allRuleDiags = [...structuralDiags, ...typeAwareDiags];
		const hasRuleError = allRuleDiags.some((d) => d.severity === "error");

		return {
			valid: !hasRuleError,
			type: typeResult.type,
			diagnostics: allRuleDiags,
		};
	}

	/**
	 * Get the inferred CEL type of the full expression.
	 * Returns undefined if the expression is invalid.
	 */
	public typeOf(expression: string): string | undefined {
		const result = this.check(expression);

		return result.type;
	}

	/**
	 * Get the inferred type at a cursor position (for hover info).
	 *
	 * Attempts to identify the sub-expression under the cursor and infer its
	 * type. Falls back to the full expression type when sub-expression
	 * isolation is not possible.
	 */
	public typeAt(expression: string, offset: number): TypeAtResult | undefined {
		if (offset < 0 || offset > expression.length) {
			return undefined;
		}

		let parsed: ParseResult;
		try {
			parsed = this.env.parse(expression);
		} catch {
			return undefined;
		}

		const hit = findNodeWithParentAt(parsed.ast, offset);
		if (!hit) {
			const fullType = this.typeOf(expression);

			return fullType
				? { type: fullType, from: 0, to: expression.length }
				: undefined;
		}

		const { node } = hit;

		// Identifier: variable or contract name
		if (node.op === "id") {
			const name = node.args;
			const span = nodeSpan(node);

			const variable = this.schema.variables.find((v) => v.name === name);
			if (variable) {
				return { type: variable.type, from: span.from, to: span.to };
			}

			const contract = this.schema.contracts.find((c) => c.name === name);
			if (contract) {
				return {
					type: contractTypeName(contract.name),
					from: span.from,
					to: span.to,
				};
			}
		}

		// Find largest dot-access/call chain containing this offset
		const chainNode = this.findContainingChain(parsed.ast, offset);
		if (chainNode) {
			const chainSpan = nodeSpan(chainNode);
			const chainExpr = expression.slice(chainSpan.from, chainSpan.to);
			const chainType = this.typeOf(chainExpr);
			if (chainType) {
				return { type: chainType, from: chainSpan.from, to: chainSpan.to };
			}
		}

		// Fall back to full expression type
		const fullType = this.typeOf(expression);

		return fullType
			? { type: fullType, from: 0, to: expression.length }
			: undefined;
	}

	/**
	 * Get type-aware completions for a cursor context.
	 *
	 * Supports:
	 * - **dot-access**: after `contract.` — lists methods of that contract
	 * - **top-level**: at the start or after operators — lists variables,
	 *   contracts, and functions
	 */
	public completionsAt(expression: string, offset: number): CompletionInfo {
		const beforeCursor = expression.slice(0, offset);
		const lastDotIdx = beforeCursor.lastIndexOf(".");

		if (lastDotIdx > 0) {
			const receiverExpr = this.extractReceiverBefore(beforeCursor, lastDotIdx);
			if (receiverExpr) {
				return this.dotCompletions(receiverExpr);
			}
		}

		// Top-level completions
		const items: CompletionItem[] = [];

		for (const variable of this.schema.variables) {
			items.push({
				label: variable.name,
				type: variable.type,
				description: variable.description,
			});
		}

		for (const contract of this.schema.contracts) {
			items.push({
				label: contract.name,
				type: contractTypeName(contract.name),
				description: contract.description,
			});
		}

		for (const fn of this.schema.functions) {
			if (!fn.receiverType) {
				items.push({
					label: fn.name,
					type: fn.returns,
					detail: fn.signature,
					description: fn.description,
				});
			}
		}

		const expected = this.expectedTypeAt(expression, offset);

		return { kind: "top-level", expectedType: expected?.expectedType, items };
	}

	/**
	 * Infer the expected type at a cursor position from surrounding context.
	 *
	 * Supports two contexts:
	 * - **Operator**: `expr > |` — infers the left operand type and derives the
	 *   expected right operand type from the operator.
	 * - **Function argument**: `contract.method(arg, |)` — looks up the
	 *   parameter type from the schema.
	 *
	 * Returns undefined when context cannot be determined, signaling that
	 * no narrowing should occur (safe fallback).
	 */
	public expectedTypeAt(
		expression: string,
		offset: number,
	): ExpectedTypeInfo | undefined {
		const beforeCursor = expression.slice(0, offset);

		// Phase A: Operator context
		const trailing = this.findTrailingOperator(beforeCursor);
		if (trailing) {
			const expected = this.expectedTypeFor({
				kind: "operator",
				leftExpression: trailing.leftExpr,
				operator: trailing.operator,
			});
			if (expected) {
				return { expectedType: expected, context: "operator" };
			}
		}

		// Phase B: Function argument context
		const callInfo = this.findEnclosingCall(expression, offset);
		if (callInfo) {
			const expected = this.expectedTypeFor({
				kind: "function-arg",
				receiverName: callInfo.receiverName,
				functionName: callInfo.functionName,
				paramIndex: callInfo.paramIndex,
			});
			if (expected) {
				return {
					expectedType: expected,
					context: "function-argument",
					paramIndex: callInfo.paramIndex,
					functionName: callInfo.functionName,
				};
			}
		}

		return undefined;
	}

	/**
	 * Resolve type and available members for a dot-access receiver expression.
	 */
	public dotCompletions(receiverExpression: string): CompletionInfo {
		// Check direct contract name
		const contract = this.schema.contracts.find(
			(c) => c.name === receiverExpression,
		);
		if (contract) {
			return {
				kind: "dot-access",
				receiverType: contractTypeName(contract.name),
				items: contract.methods.map((method) => ({
					label: method.name,
					type: method.returns,
					detail: `(${method.params.map((p) => `${p.name}: ${p.type}`).join(", ")}): ${method.returns}`,
					description: method.description,
				})),
			};
		}

		// Type-check the receiver expression
		const receiverType = this.typeOf(receiverExpression);
		if (receiverType) {
			// Check if it resolves to a contract type
			const contractByType = this.schema.contracts.find(
				(c) => contractTypeName(c.name) === receiverType,
			);
			if (contractByType) {
				return {
					kind: "dot-access",
					receiverType,
					items: contractByType.methods.map((m) => ({
						label: m.name,
						type: m.returns,
						detail: `(${m.params.map((p) => `${p.name}: ${p.type}`).join(", ")}): ${m.returns}`,
						description: m.description,
					})),
				};
			}

			// Check for receiver methods matching this type
			const baseType = receiverType.includes("<")
				? receiverType.slice(0, receiverType.indexOf("<"))
				: null;
			const receiverMethods = this.schema.functions
				.filter(
					(f) =>
						f.receiverType === receiverType ||
						(baseType !== null && f.receiverType === baseType),
				)
				.map((f) => ({
					label: f.name,
					type: f.returns,
					detail: f.signature,
					description: f.description,
				}));

			// Include list macros
			if (baseType === "list" || receiverType === "list") {
				const macroItems = this.schema.macros
					.filter((m) => m.pattern.startsWith("list."))
					.map((m) => ({
						label: m.name,
						type: "",
						detail: m.pattern,
						description: m.description,
					}));
				const seen = new Set(receiverMethods.map((m) => m.label));
				for (const item of macroItems) {
					if (!seen.has(item.label)) {
						receiverMethods.push(item);
						seen.add(item.label);
					}
				}
			}

			if (receiverMethods.length > 0) {
				return { kind: "dot-access", receiverType, items: receiverMethods };
			}

			// Check for struct field completions
			const structItems = this.structFieldsFor(receiverType);
			if (structItems) {
				return { kind: "dot-access", receiverType, items: structItems };
			}

			// Known type but no methods found
			return { kind: "dot-access", receiverType, items: [] };
		}

		return { kind: "dot-access", receiverType: receiverExpression, items: [] };
	}

	/**
	 * Resolve expected type from a structured context.
	 */
	public expectedTypeFor(
		context:
			| { kind: "operator"; leftExpression: string; operator: string }
			| {
					kind: "function-arg";
					receiverName?: string;
					functionName: string;
					paramIndex: number;
			  },
	): string | undefined {
		if (context.kind === "operator") {
			const leftType = this.typeOf(context.leftExpression);
			if (leftType) {
				return expectedTypeForOperator(leftType, context.operator) ?? undefined;
			}

			return undefined;
		}

		// function-arg
		const rawType = this.resolveRawParamType(
			context.receiverName,
			context.functionName,
			context.paramIndex,
		);

		// Skip union types
		if (rawType && !rawType.includes("|")) {
			return rawType;
		}

		return undefined;
	}

	/**
	 * Rebuild the internal environment from an updated schema.
	 */
	public updateSchema(schema: SELSchema): void {
		this.schema = schema;
		this.env = createCheckerEnvironment(schema);
		this.structTypeMap = this.buildStructTypeMap(schema);
	}

	private buildStructTypeMap(schema: SELSchema): Map<string, TypeSchema> {
		const map = new Map<string, TypeSchema>();
		for (const type of schema.types) {
			if (type.kind === "struct") {
				map.set(type.name, type);
			}
		}

		return map;
	}

	private structFieldsFor(typeName: string): CompletionItem[] | undefined {
		const structType = this.structTypeMap.get(typeName);
		if (!structType) {
			return undefined;
		}

		return (structType.fields ?? []).map((field) => ({
			label: field.name,
			type: field.type,
			detail: field.type,
			description: field.description,
		}));
	}

	/**
	 * Scan backwards from a dot position to extract the receiver expression.
	 * Handles balanced parentheses so that `foo(erc20.name().` correctly
	 * identifies `erc20.name()` as the receiver, not `foo(erc20.name()`.
	 */
	private extractReceiverBefore(text: string, dotIdx: number): string {
		let i = dotIdx - 1;

		while (i >= 0 && (text[i] === " " || text[i] === "\t")) {
			i--;
		}

		if (i < 0) {
			return "";
		}

		const isIdentStart = (code: number): boolean =>
			(code >= 65 && code <= 90) || (code >= 97 && code <= 122) || code === 95;

		const isIdentChar = (code: number): boolean =>
			isIdentStart(code) || (code >= 48 && code <= 57);

		const collectChain = (): void => {
			if (text[i] === ")") {
				const closePos = i;
				let depth = 1;
				i--;
				while (i >= 0 && depth > 0) {
					const ch = text[i];
					if (ch === ")") {
						depth++;
					} else if (ch === "(") {
						depth--;
					}

					if (depth > 0) {
						i--;
					}
				}

				if (depth !== 0) {
					i = closePos;

					return;
				}

				i--;
			}

			if (i >= 0 && isIdentChar(text.charCodeAt(i))) {
				while (i >= 0 && isIdentChar(text.charCodeAt(i))) {
					i--;
				}

				const start = i + 1;
				if (!isIdentStart(text.charCodeAt(start))) {
					return;
				}

				if (i >= 0 && text[i] === ".") {
					i--;
					collectChain();
				}
			}
		};

		collectChain();

		const start = i + 1;

		return text.slice(start, dotIdx).trimEnd();
	}

	/**
	 * Find the largest call/dot-access chain node that contains the offset.
	 */
	private findContainingChain(
		root: ASTNode,
		offset: number,
	): ASTNode | undefined {
		let best: ASTNode | undefined;

		walkAST(root, (node) => {
			if (node.op !== "." && node.op !== ".?" && node.op !== "rcall") {
				return;
			}

			const span = nodeSpan(node);
			if (offset >= span.from && offset <= span.to) {
				if (
					!best ||
					span.to - span.from > nodeSpan(best).to - nodeSpan(best).from
				) {
					best = node;
				}
			}
		});

		return best;
	}

	/**
	 * Scan backwards from the end of text to find a trailing binary operator.
	 * Tries multi-character operators first (==, !=, etc.) to avoid partial matches.
	 */
	private findTrailingOperator(
		text: string,
	): { leftExpr: string; operator: string } | undefined {
		const trimmed = text.trimEnd();

		// Multi-character operators first
		for (const op of ["==", "!=", ">=", "<=", "&&", "||", "in"]) {
			if (trimmed.endsWith(op)) {
				const left = trimmed.slice(0, -op.length).trimEnd();
				if (left) {
					return { leftExpr: left, operator: op };
				}
			}
		}

		// Single-character operators
		for (const op of [">", "<", "+", "-", "*", "/", "%"]) {
			if (trimmed.endsWith(op)) {
				const before = trimmed.slice(0, -1);

				// Guard against partial multi-char operators (>=, <=, ==, !=, &&, ||)
				const lastChar = before.at(-1);
				if (
					lastChar === ">" ||
					lastChar === "<" ||
					lastChar === "=" ||
					lastChar === "!" ||
					lastChar === "&" ||
					lastChar === "|"
				) {
					continue;
				}

				const left = before.trimEnd();
				if (left) {
					return { leftExpr: left, operator: op };
				}
			}
		}

		return undefined;
	}

	/**
	 * Find the enclosing function/method call around the cursor by scanning
	 * backwards for an unclosed `(`, then extracting the function name and
	 * counting commas to determine the parameter index.
	 */
	private findEnclosingCall(
		expression: string,
		offset: number,
	):
		| {
				receiverName?: string;
				functionName: string;
				paramIndex: number;
		  }
		| undefined {
		let depth = 0;
		let commas = 0;
		let parenPos = -1;

		for (let i = offset - 1; i >= 0; i--) {
			const ch = expression[i];
			if (ch === ")") {
				depth++;
			} else if (ch === "(") {
				if (depth === 0) {
					parenPos = i;
					break;
				}

				depth--;
			} else if (ch === "," && depth === 0) {
				commas++;
			}
		}

		if (parenPos < 0) {
			return undefined;
		}

		const beforeParen = expression.slice(0, parenPos);
		const callMatch = /(?:(\w+)\.)?(\w+)\s*$/.exec(beforeParen);
		if (!callMatch?.[2]) {
			return undefined;
		}

		return {
			receiverName: callMatch[1],
			functionName: callMatch[2],
			paramIndex: commas,
		};
	}

	/**
	 * Look up the expected parameter type from the schema for a function or
	 * method call at the given parameter index.
	 */
	private resolveRawParamType(
		receiverName: string | undefined,
		functionName: string,
		paramIndex: number,
	): string | undefined {
		if (receiverName) {
			// Method call: receiver.method(...)
			const contract = this.schema.contracts.find(
				(c) => c.name === receiverName,
			);
			if (contract) {
				const method = contract.methods.find((m) => m.name === functionName);
				if (method && paramIndex < method.params.length) {
					// eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- bounds checked above
					return method.params[paramIndex]!.type;
				}
			}
		} else {
			// Free function: func(...)
			const fn = this.schema.functions.find((f) => f.name === functionName);
			if (fn && paramIndex < fn.params.length) {
				// eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- bounds checked above
				return fn.params[paramIndex]!.type;
			}
		}

		return undefined;
	}
}
