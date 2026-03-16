import { defineConfig } from "tsdown";

export default defineConfig({
	unbundle: true,
	format: ["cjs", "esm"],
	clean: true,
	deps: { skipNodeModulesBundle: true },
});
