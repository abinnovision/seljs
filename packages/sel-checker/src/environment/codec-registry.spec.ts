import {
	SolidityAddressTypeWrapper,
	SolidityIntTypeWrapper,
} from "@seljs/types";
import { describe, expect, it } from "vitest";

import { CelCodecRegistry } from "./codec-registry.js";

const ADDR = "0xabcdef1234567890abcdef1234567890abcdef12";

describe("src/environment/codec-registry.ts", () => {
	describe("celCodecRegistry base codecs", () => {
		const registry = new CelCodecRegistry();

		it("solidityAddress decode wraps string in wrapper", () => {
			const codec = registry.resolve("sol_address");
			const result = codec.parse(ADDR);
			expect(result).toBeInstanceOf(SolidityAddressTypeWrapper);
			expect((result as SolidityAddressTypeWrapper).value).toBe(ADDR);
		});

		it("solidityAddress encode unwraps wrapper to string", () => {
			const codec = registry.resolve("sol_address") as any;
			const wrapped = new SolidityAddressTypeWrapper(ADDR);
			expect(codec.encode(wrapped)).toBe(ADDR);
		});

		it("solidityInt decode wraps bigint in wrapper", () => {
			const codec = registry.resolve("sol_int");
			const result = codec.parse(42n);
			expect(result).toBeInstanceOf(SolidityIntTypeWrapper);
			expect((result as SolidityIntTypeWrapper).value).toBe(42n);
		});

		it("solidityInt decode coerces number to bigint", () => {
			const codec = registry.resolve("sol_int");
			const result = codec.parse(788);
			expect(result).toBeInstanceOf(SolidityIntTypeWrapper);
			expect((result as SolidityIntTypeWrapper).value).toBe(788n);
		});

		it("solidityInt encode unwraps wrapper to bigint", () => {
			const codec = registry.resolve("sol_int") as any;
			const wrapped = new SolidityIntTypeWrapper(99n);
			expect(codec.encode(wrapped)).toBe(99n);
		});

		it("bool passthrough", () => {
			const codec = registry.resolve("bool");
			expect(codec.parse(true)).toBe(true);
			expect(codec.parse(false)).toBe(false);
		});

		it("string passthrough", () => {
			const codec = registry.resolve("string");
			expect(codec.parse("hello")).toBe("hello");
		});

		it("dyn passthrough", () => {
			const codec = registry.resolve("dyn");
			expect(codec.parse(42)).toBe(42);
			expect(codec.parse("anything")).toBe("anything");
		});

		it("unknown type falls back to z.unknown()", () => {
			const codec = registry.resolve("UnknownType");
			expect(codec.parse(123)).toBe(123);
			expect(codec.parse("anything")).toBe("anything");
		});
	});

	describe("celCodecRegistry list types", () => {
		const registry = new CelCodecRegistry();

		it("list<SolidityAddress> decode wraps every element", () => {
			const codec = registry.resolve("list<sol_address>");
			const input = [ADDR, ADDR];
			const result = codec.parse(input) as SolidityAddressTypeWrapper[];
			expect(result).toHaveLength(2);
			expect(result[0]).toBeInstanceOf(SolidityAddressTypeWrapper);
			expect(result[1]).toBeInstanceOf(SolidityAddressTypeWrapper);
		});

		it("list<SolidityInt> decode wraps every element", () => {
			const codec = registry.resolve("list<sol_int>");
			const result = codec.parse([1n, 2n, 3n]) as SolidityIntTypeWrapper[];
			expect(result).toHaveLength(3);
			for (const item of result) {
				expect(item).toBeInstanceOf(SolidityIntTypeWrapper);
			}
		});

		it("list<SolidityAddress> encode unwraps to strings", () => {
			// The list codec is z.array(elementCodec); for encode we verify the element codec encodes
			const elementCodec = registry.resolve("sol_address") as any;
			const wrapped = new SolidityAddressTypeWrapper(ADDR);
			expect(elementCodec.encode(wrapped)).toBe(ADDR);
		});

		it("list<string> passthrough", () => {
			const codec = registry.resolve("list<string>");
			const input = ["a", "b", "c"];
			expect(codec.parse(input)).toEqual(input);
		});
	});

	describe("celCodecRegistry struct codecs", () => {
		// eslint-disable-next-line @typescript-eslint/no-extraneous-class
		class PoolStruct {}

		const registry = new CelCodecRegistry({
			structs: [
				{
					name: "PoolStruct",
					ctor: PoolStruct,
					fieldNames: ["fee", "token"],
					fieldTypes: { fee: "sol_int", token: "sol_address" },
				},
			],
		});

		it("struct decode from object", () => {
			const codec = registry.resolve("PoolStruct");
			const result = codec.parse({ fee: 3000n, token: ADDR }) as any;
			expect(result).toBeInstanceOf(PoolStruct);
			expect(result.fee).toBeInstanceOf(SolidityIntTypeWrapper);
			expect((result.fee as SolidityIntTypeWrapper).value).toBe(3000n);
			expect(result.token).toBeInstanceOf(SolidityAddressTypeWrapper);
		});

		it("struct decode from array (multi-return)", () => {
			const codec = registry.resolve("PoolStruct");
			const result = codec.parse([500n, ADDR]) as any;
			expect(result).toBeInstanceOf(PoolStruct);
			expect(result.fee).toBeInstanceOf(SolidityIntTypeWrapper);
			expect((result.fee as SolidityIntTypeWrapper).value).toBe(500n);
			expect(result.token).toBeInstanceOf(SolidityAddressTypeWrapper);
		});
	});

	describe("celCodecRegistry nested struct decode", () => {
		// eslint-disable-next-line @typescript-eslint/no-extraneous-class
		class InnerStruct {}
		// eslint-disable-next-line @typescript-eslint/no-extraneous-class
		class OuterStruct {}

		const registry = new CelCodecRegistry({
			structs: [
				{
					name: "InnerStruct",
					ctor: InnerStruct,
					fieldNames: ["amount"],
					fieldTypes: { amount: "sol_int" },
				},
				{
					name: "OuterStruct",
					ctor: OuterStruct,
					fieldNames: ["inner", "label"],
					fieldTypes: { inner: "InnerStruct", label: "string" },
				},
			],
		});

		it("nested struct decode", () => {
			const codec = registry.resolve("OuterStruct");
			const result = codec.parse({
				inner: { amount: 42n },
				label: "hello",
			}) as any;
			expect(result).toBeInstanceOf(OuterStruct);
			expect(result.inner).toBeInstanceOf(InnerStruct);
			expect(result.inner.amount).toBeInstanceOf(SolidityIntTypeWrapper);
			expect((result.inner.amount as SolidityIntTypeWrapper).value).toBe(42n);
			expect(result.label).toBe("hello");
		});

		it("list<StructType> decode", () => {
			const codec = registry.resolve("list<OuterStruct>");
			const input = [
				{ inner: { amount: 1n }, label: "a" },
				{ inner: { amount: 2n }, label: "b" },
			];
			const result = codec.parse(input) as any[];
			expect(result).toHaveLength(2);
			expect(result[0]).toBeInstanceOf(OuterStruct);
			expect(result[0].inner).toBeInstanceOf(InnerStruct);
			expect(result[1]).toBeInstanceOf(OuterStruct);
		});
	});

	describe("celCodecRegistry.encode", () => {
		it("solidityAddress encode", () => {
			const registry = new CelCodecRegistry();
			const addr = "0x0000000000000000000000000000000000000001";
			const result = registry.encode(
				"sol_address",
				new SolidityAddressTypeWrapper(addr),
			);
			expect(result).toBe(addr);
		});

		it("solidityInt encode", () => {
			const registry = new CelCodecRegistry();
			const result = registry.encode(
				"sol_int",
				new SolidityIntTypeWrapper(42n),
			);
			expect(result).toBe(42n);
		});

		it("list<SolidityAddress> encode", () => {
			const registry = new CelCodecRegistry();
			const addr1 = "0x0000000000000000000000000000000000000001";
			const addr2 = "0x0000000000000000000000000000000000000002";
			const result = registry.encode("list<sol_address>", [
				new SolidityAddressTypeWrapper(addr1),
				new SolidityAddressTypeWrapper(addr2),
			]);
			expect(result).toEqual([addr1, addr2]);
		});

		it("passthrough for bool, string, int", () => {
			const registry = new CelCodecRegistry();
			expect(registry.encode("bool", true)).toBe(true);
			expect(registry.encode("string", "hello")).toBe("hello");
			expect(registry.encode("int", 42n)).toBe(42n);
		});

		it("unknown type passes through", () => {
			const registry = new CelCodecRegistry();
			expect(registry.encode("nonexistent", "whatever")).toBe("whatever");
		});

		it("struct encode recurses into fields", () => {
			// eslint-disable-next-line @typescript-eslint/no-extraneous-class
			class MyStruct {}
			const registry = new CelCodecRegistry({
				structs: [
					{
						name: "MyStruct",
						ctor: MyStruct,
						fieldNames: ["addr", "label"],
						fieldTypes: { addr: "sol_address", label: "string" },
					},
				],
			});
			const addr = "0x0000000000000000000000000000000000000001";
			const input = Object.assign(new MyStruct(), {
				addr: new SolidityAddressTypeWrapper(addr),
				label: "test",
			});
			const result = registry.encode("MyStruct", input) as any;
			expect(result).toEqual({ addr, label: "test" });
			expect(result).not.toBeInstanceOf(MyStruct);
		});

		it("nested struct encode", () => {
			// eslint-disable-next-line @typescript-eslint/no-extraneous-class
			class Inner {}
			// eslint-disable-next-line @typescript-eslint/no-extraneous-class
			class Outer {}
			const registry = new CelCodecRegistry({
				structs: [
					{
						name: "Inner",
						ctor: Inner,
						fieldNames: ["amount"],
						fieldTypes: { amount: "sol_int" },
					},
					{
						name: "Outer",
						ctor: Outer,
						fieldNames: ["inner", "label"],
						fieldTypes: { inner: "Inner", label: "string" },
					},
				],
			});
			const inner = Object.assign(new Inner(), {
				amount: new SolidityIntTypeWrapper(99n),
			});
			const outer = Object.assign(new Outer(), { inner, label: "hi" });
			const result = registry.encode("Outer", outer) as any;
			expect(result).toEqual({ inner: { amount: 99n }, label: "hi" });
		});

		it("list<StructType> encode", () => {
			// eslint-disable-next-line @typescript-eslint/no-extraneous-class
			class Item {}
			const registry = new CelCodecRegistry({
				structs: [
					{
						name: "Item",
						ctor: Item,
						fieldNames: ["addr"],
						fieldTypes: { addr: "sol_address" },
					},
				],
			});
			const addr1 = "0x0000000000000000000000000000000000000001";
			const addr2 = "0x0000000000000000000000000000000000000002";
			const items = [
				Object.assign(new Item(), {
					addr: new SolidityAddressTypeWrapper(addr1),
				}),
				Object.assign(new Item(), {
					addr: new SolidityAddressTypeWrapper(addr2),
				}),
			];
			const result = registry.encode("list<Item>", items);
			expect(result).toEqual([{ addr: addr1 }, { addr: addr2 }]);
		});
	});
});
