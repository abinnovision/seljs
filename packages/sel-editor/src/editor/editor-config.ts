import { closeBrackets, closeBracketsKeymap } from "@codemirror/autocomplete";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { bracketMatching } from "@codemirror/language";
import { EditorState, type Extension } from "@codemirror/state";
import { EditorView, keymap, placeholder } from "@codemirror/view";
import { celLanguageSupport } from "@seljs/cel-lezer";
import { SELChecker } from "@seljs/checker";

import { selDarkTheme, selLightTheme } from "./theme";
import { createTypeDisplay } from "./type-display";
import { createSchemaCompletion } from "../completion";
import { createTokenizerConfig } from "../language";
import { createSemanticHighlighter } from "../language/semantic-highlighter";
import { createSELLinter } from "../linting";

import type { SELEditorConfig, SELEditorFeatures } from "./types";

const resolveFeatures = (features?: SELEditorFeatures) => ({
	linting: features?.linting ?? true,
	autocomplete: features?.autocomplete ?? true,
	semanticHighlighting: features?.semanticHighlighting ?? true,
	typeDisplay: features?.typeDisplay ?? false,
});

export const buildExtensions = (config: SELEditorConfig): Extension[] => {
	const checker = new SELChecker(config.schema, config.checkerOptions);
	const resolved = resolveFeatures(config.features);
	const extensions: Extension[] = [];

	// Language support (includes syntax highlighting)
	extensions.push(celLanguageSupport(config.dark));
	extensions.push(bracketMatching());

	// Semantic highlighting (schema-aware identifier coloring)
	if (resolved.semanticHighlighting) {
		const tokenizerConfig = createTokenizerConfig(config.schema);
		extensions.push(createSemanticHighlighter(tokenizerConfig, config.dark));
	}

	// Autocomplete (type-aware via checker)
	if (resolved.autocomplete) {
		extensions.push(createSchemaCompletion(config.schema, checker));
		extensions.push(closeBrackets());
	}

	// Keybindings
	extensions.push(
		keymap.of([...closeBracketsKeymap, ...defaultKeymap, ...historyKeymap]),
	);
	extensions.push(history());

	// Theme
	extensions.push(config.dark ? selDarkTheme : selLightTheme);

	// Validation / linting
	if (resolved.linting) {
		extensions.push(
			createSELLinter({
				validate: (expression: string) => checker.check(expression).diagnostics,
			}),
		);
	}

	// onChange listener with validity
	if (config.onChange) {
		const onChange = config.onChange;
		extensions.push(
			EditorView.updateListener.of((update) => {
				if (update.docChanged) {
					const value = update.state.doc.toString();
					const result = checker.check(value);
					onChange(value, result.valid);
				}
			}),
		);
	}

	// Read-only
	if (config.readOnly) {
		extensions.push(EditorState.readOnly.of(true));
	}

	// Placeholder
	if (config.placeholder) {
		extensions.push(placeholder(config.placeholder));
	}

	// Type display panel
	if (resolved.typeDisplay) {
		extensions.push(createTypeDisplay(checker, config.dark ?? false));
	}

	return extensions;
};
