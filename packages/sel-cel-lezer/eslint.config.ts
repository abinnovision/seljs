import {
	base,
	vitest,
	stylistic,
	configFiles,
} from "@abinnovision/eslint-config-base";
import { defineConfig, globalIgnores } from "eslint/config";

export default defineConfig([
	{ extends: [base, vitest, stylistic] },
	{ files: ["*.{c,m,}{t,j}s"], extends: [configFiles] },

	// Generated files should not be linted.
	globalIgnores(["src/parser{,.terms}.ts"]),
]);
