import type { ASTNode } from "@marcbachmann/cel-js";

interface NodeSpan {
	from: number;
	to: number;
}

type ASTVisitor = (node: ASTNode, parent: ASTNode | null) => void;

const BINARY_OPS = new Set([
	"==",
	"!=",
	"<",
	"<=",
	">",
	">=",
	"+",
	"-",
	"*",
	"/",
	"%",
	"in",
	"||",
	"&&",
	"[]",
	"[?]",
]);

/**
 * Compute the source span {from, to} of an AST node.
 *
 * Uses the AST structure and `node.input` (original source) to calculate
 * positions. Does NOT use `serialize()` which normalizes whitespace,
 * quotes, and parentheses.
 *
 * Note: for binary operators, `node.pos` points to the operator token,
 * not the start of the expression. We compute `from` by finding the
 * leftmost descendant leaf position instead.
 */
const nodeSpan = (node: ASTNode): NodeSpan => {
	const src = node.input;

	if (node.op === "id") {
		return { from: node.pos, to: node.pos + node.args.length };
	}

	if (node.op === "value") {
		return valueSpan(src, node.pos);
	}

	// Composite: compute from as leftmost child start, to as rightmost child end
	const children = collectChildren(node);

	let minFrom = node.pos;
	let maxTo = node.pos;
	for (const child of children) {
		const s = nodeSpan(child);
		if (s.from < minFrom) {
			minFrom = s.from;
		}

		if (s.to > maxTo) {
			maxTo = s.to;
		}
	}

	// For unary operators, node.pos IS the start (e.g. `!` in `!x`)
	if (node.op === "!_" || node.op === "-_") {
		minFrom = node.pos;
	}

	// Handle trailing syntax for delimited constructs
	if (node.op === "." || node.op === ".?") {
		const fieldName = node.args[1];
		let i = maxTo;
		while (i < src.length && src[i] !== ".") {
			i++;
		}

		// skip dot
		i++;
		if (node.op === ".?" && i < src.length && src[i] === "?") {
			i++;
		}

		i += fieldName.length;

		return { from: minFrom, to: Math.min(i, src.length) };
	}

	if (node.op === "call" || node.op === "rcall") {
		return { from: minFrom, to: scanTo(src, maxTo, ")") };
	}

	if (node.op === "list" || node.op === "[]" || node.op === "[?]") {
		return { from: minFrom, to: scanTo(src, maxTo, "]") };
	}

	if (node.op === "map") {
		return { from: minFrom, to: scanTo(src, maxTo, "}") };
	}

	return { from: minFrom, to: maxTo };
};

/**
 * Depth-first walk of the AST, calling visitor on every node.
 */
const walkAST = (
	node: ASTNode,
	visitor: ASTVisitor,
	parent: ASTNode | null = null,
): void => {
	visitor(node, parent);
	for (const child of collectChildren(node)) {
		walkAST(child, visitor, node);
	}
};

/**
 * Collect all ASTNode children of a node, regardless of op shape.
 */
const collectChildren = (node: ASTNode): ASTNode[] => {
	if (node.op === "value" || node.op === "id") {
		return [];
	}

	if (node.op === "!_" || node.op === "-_") {
		return [node.args];
	}

	if (BINARY_OPS.has(node.op)) {
		const [left, right] = node.args as [ASTNode, ASTNode];

		return [left, right];
	}

	switch (node.op) {
		case ".":
		case ".?": {
			const [receiver] = node.args;

			return [receiver];
		}

		case "call": {
			const [, callArgs] = node.args;

			return callArgs;
		}

		case "rcall": {
			const [, receiver, callArgs] = node.args;

			return [receiver, ...callArgs];
		}

		case "list":
			return node.args;

		case "map": {
			const entries = node.args as [ASTNode, ASTNode][];

			return entries.flat();
		}

		case "?:": {
			const [cond, then, els] = node.args;

			return [cond, then, els];
		}

		default:
			return [];
	}
};

const valueSpan = (src: string, from: number): NodeSpan => {
	const ch = src[from];
	if (ch === '"' || ch === "'") {
		let i = from + 1;
		while (i < src.length && src[i] !== ch) {
			if (src[i] === "\\") {
				i++;
			}

			i++;
		}

		return { from, to: i < src.length ? i + 1 : i };
	}

	// Boolean, null, number: scan past word characters and dots (floats)
	let i = from;
	while (i < src.length && /[\w.]/.test(src[i] ?? "")) {
		i++;
	}

	return { from, to: i };
};

const scanTo = (src: string, from: number, ch: string): number => {
	let i = from;
	while (i < src.length && src[i] !== ch) {
		i++;
	}

	return i < src.length ? i + 1 : from;
};

/**
 * Find the deepest AST node whose span contains the given offset.
 *
 * Walks the tree depth-first. At each level, if a child's span contains
 * the offset, recurse into that child. Returns the deepest matching node,
 * or undefined if the offset is outside the root span.
 */
const findNodeAt = (root: ASTNode, offset: number): ASTNode | undefined => {
	const rootSpan = nodeSpan(root);
	if (offset < rootSpan.from || offset >= rootSpan.to) {
		return undefined;
	}

	const children = collectChildren(root);
	for (const child of children) {
		const childSpan = nodeSpan(child);
		if (offset >= childSpan.from && offset < childSpan.to) {
			return findNodeAt(child, offset) ?? child;
		}
	}

	return root;
};

interface NodeWithParent {
	node: ASTNode;
	parent: ASTNode | null;
}

const findNodeWithParentAt = (
	root: ASTNode,
	offset: number,
	parent: ASTNode | null = null,
): NodeWithParent | undefined => {
	const rootSpan = nodeSpan(root);
	if (offset < rootSpan.from || offset >= rootSpan.to) {
		return undefined;
	}

	const children = collectChildren(root);
	for (const child of children) {
		const childSpan = nodeSpan(child);
		if (offset >= childSpan.from && offset < childSpan.to) {
			return (
				findNodeWithParentAt(child, offset, root) ?? {
					node: child,
					parent: root,
				}
			);
		}
	}

	return { node: root, parent };
};

interface EnclosingCallInfo {
	functionName: string;
	receiverName?: string;
	paramIndex: number;
}

/**
 * Find the enclosing call/rcall node for a cursor offset and determine
 * which argument index the cursor falls within.
 *
 * Walks the AST to find call/rcall nodes whose span contains the offset,
 * then determines the argument index by checking which arg node's span
 * the offset falls within.
 */
const findEnclosingCallInfo = (
	root: ASTNode,
	offset: number,
): EnclosingCallInfo | undefined => {
	let result: EnclosingCallInfo | undefined;

	walkAST(root, (node) => {
		if (node.op !== "call" && node.op !== "rcall") {
			return;
		}

		const span = nodeSpan(node);
		if (offset < span.from || offset >= span.to) {
			return;
		}

		if (node.op === "call") {
			const [name, args] = node.args;
			const paramIndex = findArgIndex(args, offset);
			if (paramIndex >= 0) {
				result = { functionName: name, paramIndex };
			}
		}

		if (node.op === "rcall") {
			const [name, receiver, args] = node.args;
			const paramIndex = findArgIndex(args, offset);
			if (paramIndex >= 0) {
				const receiverName = receiver.op === "id" ? receiver.args : undefined;
				result = { functionName: name, receiverName, paramIndex };
			}
		}
	});

	return result;
};

/** Determine which argument index a cursor offset falls within. */
const findArgIndex = (args: ASTNode[], offset: number): number => {
	for (let i = 0; i < args.length; i++) {
		const arg = args[i];
		if (!arg) {
			continue;
		}

		const argSpan = nodeSpan(arg);
		if (offset >= argSpan.from && offset < argSpan.to) {
			return i;
		}
	}

	if (args.length > 0) {
		const lastArg = args[args.length - 1];
		if (lastArg) {
			const lastSpan = nodeSpan(lastArg);
			if (offset >= lastSpan.to) {
				return args.length;
			}
		}
	}

	return args.length === 0 ? 0 : -1;
};

export {
	collectChildren,
	findEnclosingCallInfo,
	findNodeAt,
	findNodeWithParentAt,
	nodeSpan,
	walkAST,
};
export type { ASTVisitor, EnclosingCallInfo, NodeSpan, NodeWithParent };
