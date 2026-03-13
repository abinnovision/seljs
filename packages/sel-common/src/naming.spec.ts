import { describe, expect, it } from "vitest";

import { contractTypeName, structTypeName } from "./naming.js";

describe("src/naming.ts", () => {
	describe("contractTypeName", () => {
		it("generates contract type name", () => {
			expect(contractTypeName("pool")).toBe("SEL_Contract_pool");
		});
	});

	describe("structTypeName", () => {
		it("generates struct type name for contract and method", () => {
			expect(structTypeName("pool", "getPool")).toBe("SEL_Struct_pool_getPool");
		});
	});
});
