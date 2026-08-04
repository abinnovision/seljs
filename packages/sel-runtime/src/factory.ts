import { SELRuntime } from "./environment/index.js";

import type { SELRuntimeConfig } from "./environment/index.js";

export const createSEL = (config: SELRuntimeConfig): SELRuntime =>
	new SELRuntime(config);
