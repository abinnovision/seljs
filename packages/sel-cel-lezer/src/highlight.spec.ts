import { describe, expect, it } from "vitest";

import { celLanguage, celLanguageSupport } from "./index.js";

describe("src/highlight.ts", () => {
	describe("celLanguage", () => {
		it("exports an LRLanguage instance", () => {
			expect(celLanguage).toBeDefined();
			expect(celLanguage.parser).toBeDefined();
		});

		it("parses expressions via the language parser", () => {
			const tree = celLanguage.parser.parse("erc20.balanceOf(user)");
			expect(tree.topNode.name).toBe("Expression");
		});
	});

	describe("celLanguageSupport", () => {
		it("returns a LanguageSupport instance", () => {
			const support = celLanguageSupport();
			expect(support).toBeDefined();
			expect(support.language).toBe(celLanguage);
		});
	});
});
