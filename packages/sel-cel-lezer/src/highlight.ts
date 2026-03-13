import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { styleTags, tags } from "@lezer/highlight";

export const celHighlighting = styleTags({
	Identifier: tags.variableName,
	Number: tags.number,
	String: tags.string,
	BooleanLiteral: tags.bool,
	NullLiteral: tags.null,
	LogicOp: tags.logicOperator,
	CompareOp: tags.compareOperator,
	AddOp: tags.arithmeticOperator,
	MulOp: tags.arithmeticOperator,
	in: tags.operatorKeyword,
	LineComment: tags.lineComment,
	"( )": tags.paren,
	"[ ]": tags.squareBracket,
	"{ }": tags.brace,
	", ;": tags.separator,
});

export const celLightHighlightStyle = HighlightStyle.define([
	{ tag: tags.number, color: "#2e7d32" },
	{ tag: tags.string, color: "#a65417" },
	{ tag: tags.bool, color: "#0d47a1" },
	{ tag: tags.null, color: "#0d47a1" },
	{ tag: tags.logicOperator, color: "#7c4dff" },
	{ tag: tags.compareOperator, color: "#7c4dff" },
	{ tag: tags.arithmeticOperator, color: "#7c4dff" },
	{ tag: tags.operatorKeyword, color: "#7c4dff" },
	{ tag: tags.lineComment, color: "#9e9e9e" },
	{ tag: tags.paren, color: "#795548" },
	{ tag: tags.squareBracket, color: "#795548" },
	{ tag: tags.brace, color: "#795548" },
	{ tag: tags.separator, color: "#795548" },
]);

export const celDarkHighlightStyle = HighlightStyle.define([
	{ tag: tags.number, color: "#b5cea8" },
	{ tag: tags.string, color: "#ce9178" },
	{ tag: tags.bool, color: "#569cd6" },
	{ tag: tags.null, color: "#569cd6" },
	{ tag: tags.logicOperator, color: "#c586c0" },
	{ tag: tags.compareOperator, color: "#c586c0" },
	{ tag: tags.arithmeticOperator, color: "#c586c0" },
	{ tag: tags.operatorKeyword, color: "#c586c0" },
	{ tag: tags.lineComment, color: "#6a9955" },
	{ tag: tags.paren, color: "#808080" },
	{ tag: tags.squareBracket, color: "#808080" },
	{ tag: tags.brace, color: "#808080" },
	{ tag: tags.separator, color: "#808080" },
]);

export const celSyntaxHighlighting = (dark = false) =>
	syntaxHighlighting(dark ? celDarkHighlightStyle : celLightHighlightStyle);
