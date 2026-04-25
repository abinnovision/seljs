import { Abi, AbiError } from "ox";
import { describe, expect, it } from "vitest";

import { decodeRevertData } from "./decode-revert.js";

const ERC721_ABI = Abi.from([
	"error ERC721NonexistentToken(uint256 tokenId)",
	"error InsufficientAllowance(address owner, uint256 requested, uint256 available)",
]);

describe("decodeRevertData", () => {
	it("decodes Error(string) revert reasons (ERC721 require text)", () => {
		const errorString = AbiError.from("error Error(string reason)");
		const data = AbiError.encode(errorString, [
			"ERC721: owner query for nonexistent token",
		]);

		const decoded = decodeRevertData(data, ERC721_ABI);

		expect(decoded.reason).toBe("ERC721: owner query for nonexistent token");
		expect(decoded.data).toBe(data);
		expect(decoded.decodedError).toBeUndefined();
	});

	it("decodes Panic(uint256) with a human-readable label", () => {
		const panic = AbiError.from("error Panic(uint256 code)");
		const data = AbiError.encode(panic, [0x11n]);

		const decoded = decodeRevertData(data, ERC721_ABI);

		expect(decoded.reason).toBe("Panic: arithmetic overflow or underflow");
		expect(decoded.data).toBe(data);
		expect(decoded.decodedError).toBeUndefined();
	});

	it("falls back to hex code for unknown panic codes", () => {
		const panic = AbiError.from("error Panic(uint256 code)");
		const data = AbiError.encode(panic, [0xaan]);

		const decoded = decodeRevertData(data, ERC721_ABI);

		expect(decoded.reason).toBe("Panic: panic code 0xaa");
	});

	it("decodes custom ABI errors with single-arg", () => {
		const data = AbiError.encode(ERC721_ABI, "ERC721NonexistentToken", [42n]);

		const decoded = decodeRevertData(data, ERC721_ABI);

		expect(decoded.reason).toBe("ERC721NonexistentToken(42)");
		expect(decoded.decodedError).toEqual({
			name: "ERC721NonexistentToken",
			args: [42n],
		});
		expect(decoded.data).toBe(data);
	});

	it("decodes custom ABI errors with multiple args", () => {
		const data = AbiError.encode(ERC721_ABI, "InsufficientAllowance", [
			"0x0000000000000000000000000000000000000001",
			100n,
			50n,
		]);

		const decoded = decodeRevertData(data, ERC721_ABI);

		expect(decoded.decodedError?.name).toBe("InsufficientAllowance");
		expect(decoded.decodedError?.args).toEqual([
			"0x0000000000000000000000000000000000000001",
			100n,
			50n,
		]);
		expect(decoded.reason).toContain("InsufficientAllowance(");
		expect(decoded.reason).toContain("100");
		expect(decoded.reason).toContain("50");
	});

	it("returns reverted-without-data reason for empty 0x", () => {
		const decoded = decodeRevertData("0x", ERC721_ABI);

		expect(decoded.data).toBe("0x");
		expect(decoded.reason).toBe("reverted without data");
		expect(decoded.decodedError).toBeUndefined();
	});

	it("returns raw data when selector does not match any ABI error", () => {
		const data = "0xdeadbeef" as `0x${string}`;

		const decoded = decodeRevertData(data, ERC721_ABI);

		expect(decoded.data).toBe(data);
		expect(decoded.reason).toBeUndefined();
		expect(decoded.decodedError).toBeUndefined();
	});
});
