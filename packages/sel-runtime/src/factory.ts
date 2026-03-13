import { SELRuntime, type SELRuntimeConfig } from "./environment/index.js";

export const createSEL = (config: SELRuntimeConfig): SELRuntime =>
	new SELRuntime(config);
