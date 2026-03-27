import { describe, expect, expectTypeOf, it } from "vitest";

import { contextCelTypes, primitiveCelTypes } from "./context.js";

import type { ContextCelType, InferContext } from "./context.js";

describe("src/context.ts", () => {
	describe("contextCelType", () => {
		it("accepts primitive types", () => {
			expectTypeOf<"sol_int">().toExtend<ContextCelType>();
			expectTypeOf<"sol_address">().toExtend<ContextCelType>();
			expectTypeOf<"bool">().toExtend<ContextCelType>();
			expectTypeOf<"string">().toExtend<ContextCelType>();
			expectTypeOf<"bytes">().toExtend<ContextCelType>();
		});

		it("accepts list<primitive> types", () => {
			expectTypeOf<"list<sol_int>">().toExtend<ContextCelType>();
			expectTypeOf<"list<sol_address>">().toExtend<ContextCelType>();
			expectTypeOf<"list<bool>">().toExtend<ContextCelType>();
			expectTypeOf<"list<string>">().toExtend<ContextCelType>();
			expectTypeOf<"list<bytes>">().toExtend<ContextCelType>();
		});

		it("rejects invalid types", () => {
			expectTypeOf<"list<list<sol_int>>">().not.toExtend<ContextCelType>();
			expectTypeOf<"list<uint256>">().not.toExtend<ContextCelType>();
			expectTypeOf<"map<string, sol_int>">().not.toExtend<ContextCelType>();
		});
	});

	describe("primitiveCelTypes", () => {
		it("contains all primitive types", () => {
			expect(primitiveCelTypes).toEqual([
				"sol_int",
				"sol_address",
				"bool",
				"string",
				"bytes",
			]);
		});
	});

	describe("contextCelTypes", () => {
		it("contains all primitive and list types", () => {
			expect(contextCelTypes).toEqual([
				"sol_int",
				"sol_address",
				"bool",
				"string",
				"bytes",
				"list<sol_int>",
				"list<sol_address>",
				"list<bool>",
				"list<string>",
				"list<bytes>",
			]);
		});
	});

	describe("inferContext", () => {
		it("infers primitive types", () => {
			type Ctx = InferContext<{ owner: "sol_address"; amount: "sol_int" }>;
			expectTypeOf<Ctx>().toEqualTypeOf<{
				owner: `0x${string}`;
				amount: bigint;
			}>();
		});

		it("infers list types", () => {
			type Ctx = InferContext<{
				addrs: "list<sol_address>";
				nums: "list<sol_int>";
			}>;
			expectTypeOf<Ctx>().toEqualTypeOf<{
				addrs: `0x${string}`[];
				nums: bigint[];
			}>();
		});

		it("infers list<bool> type", () => {
			type Ctx = InferContext<{ flags: "list<bool>" }>;
			expectTypeOf<Ctx>().toEqualTypeOf<{ flags: boolean[] }>();
		});

		it("infers types with description objects", () => {
			type Ctx = InferContext<{
				whitelist: {
					type: "list<sol_address>";
					description: "Allowed addresses";
				};
			}>;
			expectTypeOf<Ctx>().toEqualTypeOf<{ whitelist: `0x${string}`[] }>();
		});
	});
});
