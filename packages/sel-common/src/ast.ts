import type { ASTNode } from "@marcbachmann/cel-js";

/**
 * Checks whether a value is a CEL AST node with `op` and `args` fields.
 *
 * Needed as a runtime guard when traversing into `args` branches that
 * may contain primitives (e.g. string for `id`, LiteralValue for `value`)
 * alongside nested AST nodes.
 */
export const isAstNode = (value: unknown): value is ASTNode =>
	typeof value === "object" &&
	value !== null &&
	"op" in value &&
	"args" in value &&
	typeof (value as { op: unknown }).op === "string";
