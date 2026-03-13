import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		name: "@seljs/e2e#unit",
		include: ["src/**/*.spec.ts"],
		typecheck: { enabled: true, include: ["src/**/*.spec.ts"] },
	},
});
