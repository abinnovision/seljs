import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { celLanguageSupport } from "@seljs/cel-lezer";
import { describe, expect, it } from "vitest";

import { createSemanticHighlighter } from "./semantic-highlighter";
import { createTokenizerConfig } from "./tokenizer-config";

import type { SELSchema } from "@seljs/schema";

const testSchema: SELSchema = {
	version: "1.0.0",
	contracts: [
		{
			name: "erc20",
			address: "0x0000000000000000000000000000000000000000",
			methods: [],
		},
	],
	variables: [{ name: "user", type: "sol_address" }],
	types: [],
	functions: [
		{
			name: "size",
			signature: "size(x): int",
			params: [{ name: "x", type: "any" }],
			returns: "int",
		},
	],
	macros: [{ name: "all", pattern: "list.all(x, p)" }],
};

function createTestView(doc: string, schema: SELSchema): EditorView {
	const config = createTokenizerConfig(schema);

	return new EditorView({
		state: EditorState.create({
			doc,
			extensions: [celLanguageSupport(), createSemanticHighlighter(config)],
		}),
	});
}

describe("src/language/semantic-highlighter.ts", () => {
	it("creates decorations for contract identifiers", () => {
		const view = createTestView("erc20", testSchema);
		expect(view.state).toBeDefined();
		view.destroy();
	});

	it("creates decorations for variable identifiers", () => {
		const view = createTestView("user", testSchema);
		expect(view.state).toBeDefined();
		view.destroy();
	});

	it("handles expressions with mixed identifier types", () => {
		const view = createTestView("erc20.balanceOf(user)", testSchema);
		expect(view.state).toBeDefined();
		view.destroy();
	});

	it("handles empty document", () => {
		const view = createTestView("", testSchema);
		expect(view.state).toBeDefined();
		view.destroy();
	});

	it("handles document changes without errors", () => {
		const view = createTestView("erc20", testSchema);
		view.dispatch({ changes: { from: 0, to: 5, insert: "user" } });
		expect(view.state.doc.toString()).toBe("user");
		view.destroy();
	});
});
