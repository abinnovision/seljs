import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";

import { buildExtensions } from "./editor-config";

import type { SELEditorConfig } from "./types";

export const createSELEditor = (config: SELEditorConfig): EditorView => {
	const extensions = buildExtensions(config);

	const state = EditorState.create({
		doc: config.value ?? "",
		extensions,
	});

	return new EditorView({
		state,
		parent: config.parent,
	});
};
