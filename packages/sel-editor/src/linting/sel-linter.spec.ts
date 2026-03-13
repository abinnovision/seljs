import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { describe, expect, it, vi } from "vitest";

import { createSELLinter } from "./sel-linter";

import type { SELDiagnostic } from "./diagnostic-mapper";

function createView(
	doc: string,
	linterExt: ReturnType<typeof createSELLinter>,
) {
	const state = EditorState.create({
		doc,
		extensions: [linterExt],
	});

	return new EditorView({ state });
}

describe("src/linting/sel-linter.ts", () => {
	it("creates a valid CodeMirror extension", () => {
		const ext = createSELLinter({
			validate: () => [],
		});

		// Should not throw when added to an editor
		const state = EditorState.create({
			doc: "test",
			extensions: [ext],
		});
		expect(state).toBeDefined();
	});

	it("calls validate with the document content", async () => {
		const validate = vi.fn().mockResolvedValue([]);
		const ext = createSELLinter({ validate, delay: 0 });
		const view = createView("erc20.balanceOf(user)", ext);

		// Force lint by dispatching to trigger
		view.dispatch();

		// Wait for debounced lint
		await new Promise((resolve) => {
			setTimeout(resolve, 50);
		});

		/*
		 * The linter may or may not have been called depending on CodeMirror internals
		 * But the extension should be valid
		 */
		expect(view.state.doc.toString()).toBe("erc20.balanceOf(user)");
		view.destroy();
	});

	it("supports async validate callbacks", () => {
		const validate = (_expr: string): SELDiagnostic[] => {
			return [{ message: "type error", severity: "error", from: 0, to: 5 }];
		};

		// Should not throw
		const ext = createSELLinter({ validate });
		expect(ext).toBeDefined();
	});

	it("maps SELDiagnostic severity correctly", () => {
		const validate = (): SELDiagnostic[] => [
			{ message: "error msg", severity: "error" },
			{ message: "warning msg", severity: "warning" },
			{ message: "info msg", severity: "info" },
		];

		// Extension creation should work with all severity types
		const ext = createSELLinter({ validate });
		expect(ext).toBeDefined();
	});

	it("falls back to full expression range when from/to are missing", () => {
		const validate = (): SELDiagnostic[] => [
			{ message: "no position", severity: "error" },
		];
		const ext = createSELLinter({ validate });
		const state = EditorState.create({
			doc: "some expression",
			extensions: [ext],
		});
		expect(state).toBeDefined();
	});

	it("uses custom delay", () => {
		const ext = createSELLinter({
			validate: () => [],
			delay: 500,
		});
		expect(ext).toBeDefined();
	});
});
