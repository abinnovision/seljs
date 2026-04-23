import {
	autocompletion,
	type CompletionContext,
	type CompletionResult,
	type Completion,
} from "@codemirror/autocomplete";
import { isTypeCompatible } from "@seljs/checker";

import {
	createContractCompletions,
	createFunctionCompletions,
	createMacroCompletions,
	createMethodCompletions,
	createVariableCompletions,
} from "./completion-items";
import { getCompletionContext } from "./tree-context";

import type { Extension } from "@codemirror/state";
import type { SELChecker, CompletionItem } from "@seljs/checker";
import type { SELSchema } from "@seljs/schema";

/**
 * Determine the CodeMirror completion type from a checker CompletionItem.
 * Method details start with "(" (e.g., "(owner: sol_address): sol_int"),
 * while struct field details are plain type names (e.g., "sol_int").
 */
const completionKind = (item: CompletionItem): string =>
	item.detail?.startsWith("(") ? "method" : "property";

export class SchemaCompletionProvider {
	private topLevelCompletions: Completion[];
	private allDotCompletions: Completion[];
	private checker: SELChecker;

	public constructor(schema: SELSchema, checker: SELChecker) {
		this.checker = checker;
		const contractCompletions = createContractCompletions(schema.contracts);
		const variableCompletions = createVariableCompletions(schema.variables);
		const constantCompletions = createVariableCompletions(
			schema.constants ?? [],
		);
		const freeFunctions = schema.functions.filter((f) => !f.receiverType);
		const functionCompletions = createFunctionCompletions(freeFunctions);
		const macroCompletions = createMacroCompletions(schema.macros);
		const atomCompletions: Completion[] = [
			{ label: "true", type: "keyword" },
			{ label: "false", type: "keyword" },
			{ label: "null", type: "keyword" },
		];

		this.topLevelCompletions = [
			...contractCompletions,
			...variableCompletions,
			...constantCompletions,
			...functionCompletions,
			...atomCompletions,
		];

		// Broad matching: all methods + macros + struct fields + receiver methods
		const allMethods: Completion[] = [];
		for (const contract of schema.contracts) {
			allMethods.push(...createMethodCompletions(contract));
		}

		const structFields: Completion[] = [];
		for (const type of schema.types) {
			if (type.kind === "struct" && type.fields) {
				for (const field of type.fields) {
					structFields.push({
						label: field.name,
						type: "property",
						detail: field.type,
						info: field.description,
					});
				}
			}
		}

		const receiverMethods: Completion[] = [];
		for (const fn of schema.functions) {
			if (fn.receiverType) {
				receiverMethods.push({
					label: fn.name,
					type: "method" as const,
					detail: fn.signature,
					info: fn.description,
				});
			}
		}

		this.allDotCompletions = [
			...allMethods,
			...macroCompletions,
			...structFields,
			...receiverMethods,
		];
	}

	public completionSource = (
		context: CompletionContext,
	): CompletionResult | null => {
		const treeCtx = getCompletionContext(context.state, context.pos);

		switch (treeCtx.kind) {
			case "dot-access":
				return this.handleDotAccess(context, treeCtx);
			case "call-arg":
				return this.handleCallArg(context, treeCtx);
			case "top-level":
				return this.handleTopLevel(context, treeCtx);
		}
	};

	private handleDotAccess(
		context: CompletionContext,
		treeCtx: { kind: "dot-access"; receiverText: string; from: number },
	): CompletionResult | null {
		const { receiverText, from } = treeCtx;

		// Skip numeric identifiers (e.g., 3.14)
		if (/^\d+$/.test(receiverText)) {
			return this.handleTopLevel(context, { kind: "top-level", from });
		}

		// Use checker's direct API — tree-context already provides receiverText
		const info = this.checker.dotCompletions(receiverText);

		// Checker resolved the type and found members
		if (info.items.length > 0) {
			return {
				from,
				options: info.items.map((item) => ({
					label: item.label,
					type: completionKind(item),
					detail: item.detail,
					info: item.description,
				})),
				filter: true,
			};
		}

		/*
		 * Checker resolved to a known type but no members — no completions
		 * When receiverType !== receiverText, the checker actually resolved the type
		 */
		if (info.receiverType !== receiverText) {
			return null;
		}

		// Unresolved receiver (checker echoes identifier back) — broad fallback
		return this.allDotCompletions.length
			? { from, options: this.allDotCompletions, filter: true }
			: null;
	}

	private handleCallArg(
		context: CompletionContext,
		treeCtx: {
			kind: "call-arg";
			functionName: string;
			receiverName?: string;
			paramIndex: number;
			from: number;
		},
	): CompletionResult | null {
		// Use checker's direct API with structured context from tree
		const expectedType = this.checker.expectedTypeFor({
			kind: "function-arg",
			functionName: treeCtx.functionName,
			receiverName: treeCtx.receiverName,
			paramIndex: treeCtx.paramIndex,
		});

		if (expectedType) {
			// Filter pre-built top-level completions by type compatibility
			const filtered = this.topLevelCompletions.filter((c) => {
				if (c.type === "keyword") {
					// null is dyn — always compatible
					if (c.label === "null") {
						return true;
					}

					if (c.label === "true" || c.label === "false") {
						return isTypeCompatible("bool", expectedType);
					}
				}

				// Variables have their type in detail
				if (c.type === "variable" && c.detail) {
					return isTypeCompatible(c.detail, expectedType);
				}

				// Contracts: check contract type name compatibility
				if (c.type === "class" && c.label) {
					return isTypeCompatible(`SEL_Contract_${c.label}`, expectedType);
				}

				// Functions — include (return type not easily available)
				return true;
			});

			if (filtered.length > 0) {
				const wordMatch = context.matchBefore(/\w+/);
				const from = wordMatch?.from ?? treeCtx.from;

				return { from, options: filtered, filter: true };
			}
		}

		// No expected type or no compatible items — fall back to top-level
		return this.handleTopLevel(context, {
			kind: "top-level",
			from: treeCtx.from,
		});
	}

	private handleTopLevel(
		context: CompletionContext,
		treeCtx: { kind: "top-level"; from: number },
	): CompletionResult | null {
		const wordMatch = context.matchBefore(/\w+/);
		const from = wordMatch?.from ?? treeCtx.from;
		const hasText = !!wordMatch;

		// Type-aware narrowing
		const narrowed = this.narrowByExpectedType(context, from);
		if (narrowed && narrowed.length > 0) {
			return { from, options: narrowed, filter: true };
		}

		// Unfiltered top-level
		if (hasText) {
			return this.topLevelCompletions.length
				? { from, options: this.topLevelCompletions, filter: true }
				: null;
		}

		// Explicit activation (Ctrl+Space) with no text
		if (context.explicit && this.topLevelCompletions.length) {
			return {
				from: context.pos,
				options: this.topLevelCompletions,
				filter: true,
			};
		}

		return null;
	}

	/**
	 * Use the checker to infer the expected type at cursor position
	 * and filter completions to only type-compatible items.
	 * Returns undefined when narrowing is not possible.
	 */
	private narrowByExpectedType(
		context: CompletionContext,
		from: number,
	): Completion[] | undefined {
		const doc = context.state.doc.toString();
		const info = this.checker.completionsAt(doc, from);

		if (!info.expectedType) {
			return undefined;
		}

		const expectedType = info.expectedType;

		// Filter checker items by type compatibility
		const filtered: Completion[] = info.items
			.filter((item) => isTypeCompatible(item.type, expectedType))
			.map((item) => ({
				label: item.label,
				type: item.type.startsWith("SEL_Contract_")
					? "class"
					: item.detail
						? "function"
						: "variable",
				detail: item.detail ?? item.type,
				info: item.description,
			}));

		// Also include keywords when compatible
		if (isTypeCompatible("bool", expectedType)) {
			filtered.push(
				{ label: "true", type: "keyword" },
				{ label: "false", type: "keyword" },
			);
		}

		// null is dyn — always compatible
		filtered.push({ label: "null", type: "keyword" });

		return filtered.length > 0 ? filtered : undefined;
	}
}

export const createSchemaCompletion = (
	schema: SELSchema,
	checker: SELChecker,
): Extension => {
	const provider = new SchemaCompletionProvider(schema, checker);

	return autocompletion({
		override: [provider.completionSource],
	});
};
