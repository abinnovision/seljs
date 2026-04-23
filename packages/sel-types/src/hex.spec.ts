import { describe, expect, it } from "vitest";

import { bytesToHex, hexToBytes } from "./hex.js";

describe("src/hex.ts", () => {
	describe("hexToBytes", () => {
		it("decodes a 0x-prefixed hex string", () => {
			expect(hexToBytes("0xdeadbeef")).toEqual(
				new Uint8Array([0xde, 0xad, 0xbe, 0xef]),
			);
		});

		it("decodes a hex string without 0x prefix", () => {
			expect(hexToBytes("deadbeef")).toEqual(
				new Uint8Array([0xde, 0xad, 0xbe, 0xef]),
			);
		});

		it("accepts mixed case", () => {
			expect(hexToBytes("0xDeAdBeEf")).toEqual(
				new Uint8Array([0xde, 0xad, 0xbe, 0xef]),
			);
		});

		it("decodes the empty string to an empty array", () => {
			expect(hexToBytes("")).toEqual(new Uint8Array(0));
			expect(hexToBytes("0x")).toEqual(new Uint8Array(0));
		});

		it("rejects odd-length input", () => {
			expect(() => hexToBytes("0x0")).toThrow("even-length");
			expect(() => hexToBytes("abc")).toThrow("even-length");
		});

		it("rejects non-hex characters", () => {
			expect(() => hexToBytes("0xZZ")).toThrow("invalid hex");
			expect(() => hexToBytes("0xgg")).toThrow("invalid hex");
		});
	});

	describe("bytesToHex", () => {
		it("encodes bytes with a 0x prefix", () => {
			expect(bytesToHex(new Uint8Array([0xde, 0xad, 0xbe, 0xef]))).toBe(
				"0xdeadbeef",
			);
		});

		it("zero-pads single-digit bytes", () => {
			expect(bytesToHex(new Uint8Array([0x00, 0x01, 0x0a]))).toBe("0x00010a");
		});

		it("encodes the empty array to 0x", () => {
			expect(bytesToHex(new Uint8Array(0))).toBe("0x");
		});

		it("round-trips through hexToBytes", () => {
			const original = new Uint8Array(32);
			for (let i = 0; i < 32; i++) {
				original[i] = i * 7;
			}

			expect(hexToBytes(bytesToHex(original))).toEqual(original);
		});
	});
});
