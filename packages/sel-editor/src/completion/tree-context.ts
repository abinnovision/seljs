import { syntaxTree } from "@codemirror/language";

import type { EditorState } from "@codemirror/state";
import type { SyntaxNode } from "@lezer/common";

/**
 * Walk up the tree looking for a MemberExpression ancestor.
 * A MemberExpression has two Identifier children (or child nodes) separated by ".".
 * The dot position is: firstChild.to + 1 (the "." character is between them).
 * We are in dot-access context when pos >= dotPos.
 */
const findDotAccess = (
	state: EditorState,
	node: SyntaxNode,
	pos: number,
): TreeCompletionContext | undefined => {
	let current: SyntaxNode | null = node;

	while (current) {
		/*
		 * Stop at ArgList boundary — don't match outer MemberExpressions
		 * that wrap the entire call (e.g., `erc20.balanceOf(user)` at `user`)
		 */
		if (current.name === "ArgList") {
			break;
		}

		if (
			current.name === "MemberExpression" ||
			current.name === "OptionalExpression"
		) {
			const firstChild = current.firstChild;
			if (firstChild) {
				/*
				 * The dot is immediately after the first child
				 * For MemberExpression: firstChild.to is where the "." starts
				 * (the token "." is not a named node, it's between firstChild and secondChild)
				 */
				// position after "."
				const dotPos = firstChild.to + 1;

				if (pos >= dotPos) {
					const receiverText = state.doc.sliceString(
						current.from,
						firstChild.to,
					);

					return {
						kind: "dot-access",
						receiverText,
						from: dotPos,
					};
				}
			}
		}

		current = current.parent;
	}

	return undefined;
};

/**
 * Count commas in ArgList text that appear before pos.
 * Commas are anonymous tokens not exposed as named children,
 * so we scan the raw source text.
 */
const countCommasBefore = (
	argList: SyntaxNode,
	state: EditorState,
	pos: number,
): number => {
	/*
	 * Only scan from the opening "(" up to pos
	 * skip "("
	 */
	const open = argList.from + 1;
	const end = Math.min(pos, argList.to);
	const text = state.doc.sliceString(open, end);
	let count = 0;
	for (const ch of text) {
		if (ch === ",") {
			count++;
		}
	}

	return count;
};

/**
 * Extract function name and optional receiver name from a CallExpression node.
 *
 * Tree shapes:
 *   foo(...)          → CallExpression > Identifier, ArgList
 *   erc20.foo(...)    → CallExpression > MemberExpression(Identifier "erc20", Identifier "foo"), ArgList
 */
const extractCallInfo = (
	state: EditorState,
	callExpr: SyntaxNode,
): { functionName: string; receiverName?: string } | undefined => {
	// The callee is everything before the ArgList (first child)
	const callee = callExpr.firstChild;
	if (!callee) {
		return undefined;
	}

	if (callee.name === "Identifier") {
		// Simple function call: foo(...)
		return { functionName: state.doc.sliceString(callee.from, callee.to) };
	}

	if (callee.name === "MemberExpression") {
		/*
		 * Method call: receiver.method(...)
		 * MemberExpression has two children: receiver and method name (Identifier)
		 */
		const lastChild = callee.lastChild;
		if (lastChild?.name === "Identifier") {
			const functionName = state.doc.sliceString(lastChild.from, lastChild.to);

			// Receiver is first child of MemberExpression
			const receiverNode = callee.firstChild;
			const receiverName =
				receiverNode?.name === "Identifier"
					? state.doc.sliceString(receiverNode.from, receiverNode.to)
					: undefined;

			return { functionName, receiverName };
		}
	}

	return undefined;
};

const findWordStart = (state: EditorState, pos: number): number => {
	const text = state.doc.sliceString(0, pos);
	const match = /\w+$/.exec(text);

	return match ? pos - match[0].length : pos;
};

/**
 * Walk up the tree looking for an ArgList ancestor.
 * When found, count commas before pos to get paramIndex,
 * then extract function name and optional receiver from the CallExpression.
 */
const findCallArg = (
	state: EditorState,
	node: SyntaxNode,
	pos: number,
): TreeCompletionContext | undefined => {
	let current: SyntaxNode | null = node;

	while (current) {
		if (current.name === "ArgList") {
			const paramIndex = countCommasBefore(current, state, pos);
			const callExpr = current.parent;
			if (callExpr?.name === "CallExpression") {
				const info = extractCallInfo(state, callExpr);
				if (info) {
					return {
						kind: "call-arg",
						functionName: info.functionName,
						receiverName: info.receiverName,
						paramIndex,
						from: pos,
					};
				}
			}
		}

		current = current.parent;
	}

	return undefined;
};

/**
 * Completion context extracted from the syntax tree at the cursor position.
 */
export type TreeCompletionContext =
	| { kind: "dot-access"; receiverText: string; from: number }
	| {
			kind: "call-arg";
			functionName: string;
			receiverName?: string;
			paramIndex: number;
			from: number;
	  }
	| { kind: "top-level"; from: number };

/**
 * Extract completion context from the Lezer syntax tree at the given position.
 */
export const getCompletionContext = (
	state: EditorState,
	pos: number,
): TreeCompletionContext => {
	const tree = syntaxTree(state);
	const node = tree.resolveInner(pos, -1);

	/*
	 * Check for dot-access first: cursor is after a "." in a MemberExpression
	 * This must come before call-arg so that dot-access inside parentheses
	 * (e.g., `contract.method(contract.)`) is handled correctly.
	 */
	const dotAccess = findDotAccess(state, node, pos);
	if (dotAccess) {
		return dotAccess;
	}

	// Check for call-arg: cursor is inside an ArgList
	const callArg = findCallArg(state, node, pos);
	if (callArg) {
		return callArg;
	}

	// Default: top-level completion
	return { kind: "top-level", from: findWordStart(state, pos) };
};
