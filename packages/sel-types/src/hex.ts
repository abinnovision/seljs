const HEX_PATTERN = /^[0-9a-fA-F]*$/;

/**
 * Decode a hex string into a `Uint8Array`. Accepts an optional `0x` / `0X`
 * prefix. The remaining content must be an even-length sequence of hex
 * characters.
 */
export const hexToBytes = (input: string): Uint8Array => {
	const body =
		input.startsWith("0x") || input.startsWith("0X") ? input.slice(2) : input;

	if (body.length % 2 !== 0) {
		throw new TypeError(
			`hexToBytes: expected even-length hex string, got ${String(body.length)} chars`,
		);
	}

	if (!HEX_PATTERN.test(body)) {
		throw new TypeError(`hexToBytes: invalid hex character in "${input}"`);
	}

	const bytes = new Uint8Array(body.length / 2);
	for (let i = 0; i < bytes.length; i++) {
		bytes[i] = parseInt(body.slice(i * 2, i * 2 + 2), 16);
	}

	return bytes;
};

/**
 * Encode a `Uint8Array` as a `0x`-prefixed lowercase hex string.
 */
export const bytesToHex = (bytes: Uint8Array): string => {
	let out = "0x";
	for (const byte of bytes) {
		out += byte.toString(16).padStart(2, "0");
	}

	return out;
};
