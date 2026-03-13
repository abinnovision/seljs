import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
	resolve: {
		alias: {
			"@": path.resolve(import.meta.dirname, "../../src"),
		},
	},
	test: {
		name: "@seljs/e2e#e2e",
		include: ["./**/*.e2e.ts"],
		typecheck: {
			enabled: true,
			tsconfig: "../../tsconfig.json",
		},
	},
});
