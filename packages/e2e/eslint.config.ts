import {
	base,
	vitest,
	stylistic,
	configFiles,
} from "@abinnovision/eslint-config-base";
import { defineConfig } from "eslint/config";

export default defineConfig([
	{ extends: [base, vitest, stylistic] },
	{ files: ["*.{c,m,}{t,j}s"], extends: [configFiles] },
	{
		/*
		 * The fixture runner generates tests from declarative fixture groups where
		 * each case opts into a subset of assertions. Guarding those assertions on
		 * the fixture fields that declare them is the intended design, not an
		 * accidental conditional.
		 */
		files: ["test/e2e/runner.ts"],
		rules: {
			"vitest/no-conditional-in-test": "off",
			"vitest/no-conditional-expect": "off",
		},
	},
]);
