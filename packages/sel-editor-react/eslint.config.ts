import {
	base,
	configFiles,
	stylistic,
	vitest,
} from "@abinnovision/eslint-config-base";
import { defineConfig } from "eslint/config";

export default defineConfig([
	{ extends: [base, vitest, stylistic] },
	{ files: ["*.{c,m,}{t,j}s"], extends: [configFiles] },
	{
		/*
		 * Storybook stories are dev-only and excluded from the published `dist`,
		 * so they may import devDependencies.
		 */
		files: ["**/*.stories.{t,j}s{,x}"],
		rules: { "import/no-extraneous-dependencies": "off" },
	},
]);
