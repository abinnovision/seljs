import * as _contracts from "./contracts.js";
import * as _synthetic from "./synthetic.js";

import type { ContractFixture } from "./types.js";

export type { ContractFixture } from "./types.js";
export * from "./contracts.js";
export * from "./synthetic.js";
export * from "./mock-client.js";
export * from "./routes.js";

/**
 * Helper export that combines all the fixtures into a single object.
 */
export const allContractFixtures = {
	..._contracts,
	..._synthetic,
} as const satisfies Record<string, ContractFixture>;
