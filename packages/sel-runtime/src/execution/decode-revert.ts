import { type Abi, AbiError } from "ox";

interface DecodedRevert {
	data: `0x${string}`;
	reason?: string;
	decodedError?: { name: string; args: readonly unknown[] };
}

const ERROR_STRING_SELECTOR = "0x08c379a0";
const PANIC_SELECTOR = "0x4e487b71";

const PANIC_CODES: Record<number, string> = {
	0x00: "generic panic",
	0x01: "assertion failed",
	0x11: "arithmetic overflow or underflow",
	0x12: "division or modulo by zero",
	0x21: "enum conversion out of bounds",
	0x22: "incorrectly encoded storage byte array",
	0x31: "pop on empty array",
	0x32: "array index out of bounds",
	0x41: "excessive memory allocation",
	0x51: "zero-initialized internal function type",
};

const errorStringAbi = AbiError.from("error Error(string reason)");
const panicAbi = AbiError.from("error Panic(uint256 code)");

function decodeRevertData(data: `0x${string}`, abi: Abi.Abi): DecodedRevert {
	if (data === "0x" || data.length < 10) {
		return { data };
	}

	const selector = data.slice(0, 10).toLowerCase() as `0x${string}`;

	if (selector === ERROR_STRING_SELECTOR) {
		try {
			const reason = AbiError.decode(errorStringAbi, data);

			return { data, reason };
		} catch {
			return { data };
		}
	}

	if (selector === PANIC_SELECTOR) {
		try {
			const code = AbiError.decode(panicAbi, data);
			const numeric = Number(code);
			const label =
				PANIC_CODES[numeric] ?? `panic code 0x${numeric.toString(16)}`;

			return { data, reason: `Panic: ${label}` };
		} catch {
			return { data };
		}
	}

	try {
		const error = AbiError.fromAbi(abi, data);
		const decoded = AbiError.decode(error, data);
		const args: readonly unknown[] =
			decoded === undefined ? [] : Array.isArray(decoded) ? decoded : [decoded];
		const formattedArgs = args.map(formatArg).join(", ");

		return {
			data,
			reason: `${error.name}(${formattedArgs})`,
			decodedError: { name: error.name, args },
		};
	} catch {
		return { data };
	}
}

function formatArg(arg: unknown): string {
	if (typeof arg === "bigint") {
		return arg.toString();
	}

	if (typeof arg === "string") {
		return arg;
	}

	if (
		typeof arg === "number" ||
		typeof arg === "boolean" ||
		arg === null ||
		arg === undefined
	) {
		return String(arg);
	}

	if (Array.isArray(arg)) {
		return `[${arg.map(formatArg).join(", ")}]`;
	}

	if (typeof arg === "object") {
		const entries = Object.entries(arg as Record<string, unknown>).map(
			([k, v]) => `${k}: ${formatArg(v)}`,
		);

		return `{${entries.join(", ")}}`;
	}

	return "";
}

export { decodeRevertData };
export type { DecodedRevert };
