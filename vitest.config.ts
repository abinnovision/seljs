import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		coverage: {
			enabled: true,
			provider: "v8",
			clean: true,
			include: ["packages/*/src/**/*.{ts,tsx}"],
		},
		projects: [
			"packages/*/vitest.config.ts",
			"packages/*/test/integration/vitest.config.ts",
			"packages/*/test/e2e/vitest.config.ts",
		],
	},
});
