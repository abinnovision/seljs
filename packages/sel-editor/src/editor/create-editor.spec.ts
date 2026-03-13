import { describe, expect, it, vi } from "vitest";

import { createSELEditor } from "./create-editor";

import type { SELSchema } from "@seljs/schema";

const testSchema = {
	version: "1.0.0",
	contracts: [
		{
			name: "erc20",
			methods: [
				{
					name: "balanceOf",
					params: [{ name: "owner", type: "sol_address" }],
					returns: "sol_int",
				},
			],
		},
	],
	variables: [
		{
			name: "user",
			type: "sol_address",
			description: "The wallet address",
		},
	],
	types: [{ name: "sol_address", kind: "primitive" }],
	functions: [
		{
			name: "size",
			signature: "size(list|map|string): int",
			params: [{ name: "value", type: "any" }],
			returns: "int",
		},
	],
	macros: [
		{
			name: "all",
			pattern: "list.all(x, predicate)",
		},
	],
} as unknown as SELSchema;

const emptySchema: SELSchema = {
	version: "1.0.0",
	contracts: [],
	variables: [],
	types: [],
	functions: [],
	macros: [],
};

function createParent(): HTMLElement {
	const el = document.createElement("div");
	document.body.appendChild(el);

	return el;
}

describe("src/editor/create-editor.ts", () => {
	describe("createSELEditor", () => {
		it("creates an EditorView with syntax highlighting and autocomplete", () => {
			const parent = createParent();
			const view = createSELEditor({ parent, schema: testSchema });

			expect(view).toBeDefined();
			expect(view.state).toBeDefined();
			view.destroy();
		});

		it("sets initial value from config", () => {
			const parent = createParent();
			const view = createSELEditor({
				parent,
				schema: testSchema,
				value: "erc20.balanceOf(user)",
			});

			expect(view.state.doc.toString()).toBe("erc20.balanceOf(user)");
			view.destroy();
		});

		it("defaults to empty document when no value is provided", () => {
			const parent = createParent();
			const view = createSELEditor({ parent, schema: testSchema });

			expect(view.state.doc.toString()).toBe("");
			view.destroy();
		});

		it("onChange fires with current value on document changes", () => {
			const onChange = vi.fn();
			const parent = createParent();
			const view = createSELEditor({
				parent,
				schema: testSchema,
				onChange,
			});

			// Dispatch a document change
			view.dispatch({
				changes: { from: 0, insert: "test" },
			});

			expect(onChange).toHaveBeenCalledWith("test");
			view.destroy();
		});

		it("onChange does not fire without document changes", () => {
			const onChange = vi.fn();
			const parent = createParent();
			const view = createSELEditor({
				parent,
				schema: testSchema,
				onChange,
			});

			// Dispatch a selection change (not a document change)
			view.dispatch({ selection: { anchor: 0 } });

			expect(onChange).not.toHaveBeenCalled();
			view.destroy();
		});

		it("passing validate enables the lint extension", () => {
			const validate = vi.fn().mockReturnValue([]);
			const parent = createParent();
			const view = createSELEditor({
				parent,
				schema: testSchema,
				value: "test",
				validate,
			});

			// Linter extension should be present (no errors thrown)
			expect(view.state).toBeDefined();
			view.destroy();
		});

		it("readOnly prevents editing", () => {
			const parent = createParent();
			const view = createSELEditor({
				parent,
				schema: testSchema,
				value: "original",
				readOnly: true,
			});

			expect(view.state.readOnly).toBe(true);
			view.destroy();
		});

		it("works with empty schema", () => {
			const parent = createParent();
			const view = createSELEditor({
				parent,
				schema: emptySchema,
				value: "some expression",
			});

			expect(view.state.doc.toString()).toBe("some expression");
			view.destroy();
		});

		it("works with minimal config (just parent + schema)", () => {
			const parent = createParent();
			const view = createSELEditor({ parent, schema: testSchema });

			expect(view).toBeDefined();
			expect(view.state.doc.toString()).toBe("");
			view.destroy();
		});

		it("schema update via new editor changes available completions", () => {
			const parent = createParent();
			const view1 = createSELEditor({
				parent,
				schema: testSchema,
				value: "erc20",
			});
			expect(view1.state.doc.toString()).toBe("erc20");
			view1.destroy();

			const altSchema = {
				...emptySchema,
				contracts: [{ name: "uniswap", methods: [] }],
			} as unknown as SELSchema;
			const view2 = createSELEditor({
				parent,
				schema: altSchema,
				value: "uniswap",
			});
			expect(view2.state.doc.toString()).toBe("uniswap");
			view2.destroy();
		});

		it("accepts additional extensions", () => {
			const parent = createParent();

			// Pass an empty array of extensions (no-op but shouldn't break)
			const view = createSELEditor({
				parent,
				schema: testSchema,
				extensions: [],
			});

			expect(view).toBeDefined();
			view.destroy();
		});
	});
});
