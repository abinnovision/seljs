import { closeBrackets, closeBracketsKeymap } from "@codemirror/autocomplete";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { bracketMatching } from "@codemirror/language";
import { EditorState, type Extension } from "@codemirror/state";
import { EditorView, keymap, placeholder } from "@codemirror/view";
import { celLanguageSupport } from "@seljs/cel-lezer";
import { SELChecker, rules } from "@seljs/checker";

import { selDarkTheme, selLightTheme } from "./theme";
import { createTypeDisplay } from "./type-display";
import { createSchemaCompletion } from "../completion/schema-completion";
import { createSemanticHighlighter } from "../language/semantic-highlighter";
import { createTokenizerConfig } from "../language/tokenizer-config";
import { createSELLinter } from "../linting/sel-linter";

import type { SELEditorConfig } from "./types";

export const buildExtensions = (config: SELEditorConfig): Extension[] => {
	const checker = new SELChecker(config.schema, { rules: [...rules.builtIn] });
	const extensions: Extension[] = [];

	// Language support (includes syntax highlighting)
	extensions.push(celLanguageSupport(config.dark));
	extensions.push(bracketMatching());

	// Semantic highlighting (schema-aware identifier coloring)
	const tokenizerConfig = createTokenizerConfig(config.schema);
	extensions.push(createSemanticHighlighter(tokenizerConfig, config.dark));

	// Autocomplete (type-aware via checker)
	extensions.push(createSchemaCompletion(config.schema, checker));
	extensions.push(closeBrackets());

	// Keybindings
	extensions.push(
		keymap.of([...closeBracketsKeymap, ...defaultKeymap, ...historyKeymap]),
	);
	extensions.push(history());

	// Theme
	extensions.push(config.dark ? selDarkTheme : selLightTheme);

	// Validation / linting (built-in checker used when no validate callback provided)
	const validate =
		config.validate ??
		((expression: string) => checker.check(expression).diagnostics);
	extensions.push(
		createSELLinter({
			validate,
			delay: config.validateDelay,
		}),
	);

	// onChange listener
	if (config.onChange) {
		const onChange = config.onChange;
		extensions.push(
			EditorView.updateListener.of((update) => {
				if (update.docChanged) {
					onChange(update.state.doc.toString());
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
	if (config.showType) {
		extensions.push(createTypeDisplay(checker, config.dark ?? false));
	}

	// User-provided extensions (last, so they can override)
	if (config.extensions) {
		extensions.push(...config.extensions);
	}

	return extensions;
};
