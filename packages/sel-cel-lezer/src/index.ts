import { LRLanguage, LanguageSupport } from "@codemirror/language";

import { celHighlighting, celSyntaxHighlighting } from "./highlight.js";
import { parser } from "./parser.js";

export * from "./highlight.js";

export const celLanguage = LRLanguage.define({
	name: "cel",
	parser: parser.configure({ props: [celHighlighting] }),
	languageData: {
		commentTokens: { line: "//" },
		closeBrackets: { brackets: ["(", "[", "{", '"', "'"] },
	},
});

export const celLanguageSupport = (dark = false) =>
	new LanguageSupport(celLanguage, [celSyntaxHighlighting(dark)]);
