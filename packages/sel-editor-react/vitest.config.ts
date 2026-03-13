import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		name: "@seljs/editor-react#unit",
		include: ["src/**/*.spec.{ts,tsx}"],
		environment: "jsdom",
		typecheck: { enabled: true, include: ["src/**/*.spec.{ts,tsx}"] },
	},
});
