import { EditorView } from "@codemirror/view";

export const selLightTheme = EditorView.theme({
	"&": {
		fontSize: "14px",
		backgroundColor: "#ffffff",
		color: "#1e1e1e",
	},
	".cm-content": {
		caretColor: "#000000",
		fontFamily: "'JetBrains Mono', 'Fira Code', 'Consolas', monospace",
		padding: "4px 0",
	},
	"&.cm-focused .cm-cursor": {
		borderLeftColor: "#000000",
	},
	"&.cm-focused .cm-selectionBackground, .cm-selectionBackground": {
		backgroundColor: "#d7d4f0",
	},
	".cm-gutters": {
		display: "none",
	},
});

export const selDarkTheme = EditorView.theme(
	{
		"&": {
			fontSize: "14px",
			backgroundColor: "#1e1e1e",
			color: "#d4d4d4",
		},
		".cm-content": {
			caretColor: "#ffffff",
			fontFamily: "'JetBrains Mono', 'Fira Code', 'Consolas', monospace",
			padding: "4px 0",
		},
		"&.cm-focused .cm-cursor": {
			borderLeftColor: "#ffffff",
		},
		"&.cm-focused .cm-selectionBackground, .cm-selectionBackground": {
			backgroundColor: "#264f78",
		},
		".cm-gutters": {
			display: "none",
		},
	},
	{ dark: true },
);
