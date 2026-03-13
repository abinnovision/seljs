import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		name: "@seljs/editor#unit",
		include: ["src/**/*.spec.ts"],
		environment: "jsdom",
		typecheck: { enabled: true, include: ["src/**/*.spec.ts"] },
	},
});
