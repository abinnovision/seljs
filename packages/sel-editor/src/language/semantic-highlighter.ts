import { syntaxTree } from "@codemirror/language";
import { type Extension, RangeSetBuilder } from "@codemirror/state";
import {
	Decoration,
	type DecorationSet,
	ViewPlugin,
	type ViewUpdate,
} from "@codemirror/view";

import type { TokenizerConfig } from "./tokenizer-config";
import type { EditorView } from "@codemirror/view";

const LIGHT_COLORS = {
	contract: "#00695c",
	function: "#1565c0",
	macro: "#6a1b9a",
	variable: "#37474f",
} as const;

const DARK_COLORS = {
	contract: "#4db6ac",
	function: "#64b5f6",
	macro: "#ce93d8",
	variable: "#b0bec5",
} as const;

const createDecorations = (dark: boolean) => {
	const colors = dark ? DARK_COLORS : LIGHT_COLORS;

	return {
		contract: Decoration.mark({
			attributes: { style: `color: ${colors.contract}` },
		}),
		function: Decoration.mark({
			attributes: { style: `color: ${colors.function}` },
		}),
		macro: Decoration.mark({ attributes: { style: `color: ${colors.macro}` } }),
		variable: Decoration.mark({
			attributes: { style: `color: ${colors.variable}` },
		}),
	};
};

const buildDecorations = (
	view: EditorView,
	config: TokenizerConfig,
	decos: ReturnType<typeof createDecorations>,
): DecorationSet => {
	const builder = new RangeSetBuilder<Decoration>();
	const tree = syntaxTree(view.state);

	for (const { from, to } of view.visibleRanges) {
		tree.iterate({
			from,
			to,
			enter(node) {
				if (node.name !== "Identifier") {
					return;
				}

				const name = view.state.doc.sliceString(node.from, node.to);

				let deco: Decoration | undefined;
				if (config.contractNames.has(name)) {
					deco = decos.contract;
				} else if (config.functionNames.has(name)) {
					deco = decos.function;
				} else if (config.macroNames.has(name)) {
					deco = decos.macro;
				} else if (config.variableNames.has(name)) {
					deco = decos.variable;
				}

				if (deco) {
					builder.add(node.from, node.to, deco);
				}
			},
		});
	}

	return builder.finish();
};

export const createSemanticHighlighter = function (
	config: TokenizerConfig,
	dark = false,
): Extension {
	const decos = createDecorations(dark);

	return ViewPlugin.define(
		(view) => ({
			decorations: buildDecorations(view, config, decos),
			update(update: ViewUpdate) {
				if (update.docChanged || update.viewportChanged) {
					this.decorations = buildDecorations(update.view, config, decos);
				}
			},
		}),
		{
			decorations: (v) => v.decorations,
		},
	);
};
