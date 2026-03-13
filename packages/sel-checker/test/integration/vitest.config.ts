import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		name: "@seljs/checker#integration",
		include: ["**/*.spec.ts"],
		testTimeout: 30_000,
		typecheck: { enabled: true, include: ["**/*.ts"] },
	},
});
