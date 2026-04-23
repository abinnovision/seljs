import {
	hexToBytes,
	SolidityAddressTypeWrapper,
	SolidityIntTypeWrapper,
} from "@seljs/types";
import { z } from "zod";

// Bidirectional codec types
type AnyCodec = z.ZodType;

/** Marker for struct codecs so encode knows to recurse into fields. */
interface StructMeta {
	fieldNames: string[];
	fieldTypes: Record<string, string>;
}

const solidityAddressCodec = z.codec(
	z.string(),
	z.instanceof(SolidityAddressTypeWrapper),
	{
		decode: (s) => new SolidityAddressTypeWrapper(s),
		encode: (w) => w.value,
	},
);

const solidityIntCodec = z.codec(
	z.union([z.bigint(), z.number().transform((n) => BigInt(n))]),
	z.instanceof(SolidityIntTypeWrapper),
	{
		decode: (n) => new SolidityIntTypeWrapper(n),
		encode: (w) => w.value,
	},
);

/**
 * Struct descriptor provided to CelCodecRegistry.
 */
export interface StructCodecDescriptor {
	name: string;
	ctor: new () => object;
	fieldNames: string[];
	fieldTypes: Record<string, string>;
}

/**
 * Options for constructing a CelCodecRegistry.
 */
export interface CelCodecRegistryOptions {
	structs?: StructCodecDescriptor[];
}

/**
 * Registry that maps CEL type strings to bidirectional Zod 4 codecs.
 * Immutable after construction — all codecs resolved eagerly.
 */
export class CelCodecRegistry {
	private readonly codecs: Map<string, AnyCodec>;
	private readonly structMetas: Map<string, StructMeta>;

	public constructor(options?: CelCodecRegistryOptions) {
		this.codecs = new Map<string, AnyCodec>();
		this.structMetas = new Map<string, StructMeta>();

		// Register base codecs
		this.codecs.set("sol_address", solidityAddressCodec);
		this.codecs.set("sol_int", solidityIntCodec);
		this.codecs.set("bool", z.boolean());
		this.codecs.set("string", z.string());
		this.codecs.set("int", z.bigint());
		this.codecs.set(
			"bytes",
			z.union([
				z.instanceof(Uint8Array),
				z.string().transform((s) => hexToBytes(s)),
			]),
		);
		this.codecs.set(
			"dyn",
			z
				.unknown()
				.transform((v) =>
					typeof v === "bigint" ? new SolidityIntTypeWrapper(v) : v,
				),
		);

		// Register struct codecs eagerly
		for (const desc of options?.structs ?? []) {
			this.codecs.set(desc.name, this.buildStructCodec(desc));
			this.structMetas.set(desc.name, {
				fieldNames: desc.fieldNames,
				fieldTypes: desc.fieldTypes,
			});
		}
	}

	/**
	 * Resolve a codec for the given CEL type string.
	 * Handles `list<T>` container types by composing element codecs.
	 * Unknown types fall back to z.unknown().
	 */
	public resolve(celType: string): AnyCodec {
		// Handle list<T> container type
		const listMatch = /^list<(.+)>$/.exec(celType);
		if (listMatch) {
			const elementCodec = this.resolve(listMatch[1]!);

			return z.array(elementCodec as z.ZodType);
		}

		return this.codecs.get(celType) ?? z.unknown();
	}

	/**
	 * Encode a CEL value back to its raw form using the codec for the given type.
	 * For bidirectional codecs (SolidityAddress, SolidityInt) this calls .encode().
	 * For structs, it recursively encodes each field.
	 * For passthrough types (bool, string, int), returns the value as-is.
	 */
	public encode(celType: string, value: unknown): unknown {
		// Handle bytes — convert Uint8Array back to hex string for viem
		if (celType === "bytes") {
			if (value instanceof Uint8Array) {
				return (
					"0x" +
					Array.from(value)
						.map((b) => b.toString(16).padStart(2, "0"))
						.join("")
				);
			}

			return value;
		}

		// Handle dyn — unwrap known wrapper types
		if (celType === "dyn") {
			if (value instanceof SolidityIntTypeWrapper) {
				return value.value;
			}

			if (value instanceof SolidityAddressTypeWrapper) {
				return value.value;
			}

			return value;
		}

		// Handle list<T>
		const listMatch = /^list<(.+)>$/.exec(celType);
		if (listMatch && Array.isArray(value)) {
			const elementType = listMatch[1]!;

			return value.map((item) => this.encode(elementType, item));
		}

		// Handle structs — recurse into fields
		const structMeta = this.structMetas.get(celType);
		if (structMeta) {
			const raw = value as Record<string, unknown>;
			const result: Record<string, unknown> = {};
			for (const name of structMeta.fieldNames) {
				result[name] = this.encode(
					structMeta.fieldTypes[name] ?? "dyn",
					raw[name],
				);
			}

			return result;
		}

		// For bidirectional codecs, use .encode(); for passthrough, return as-is
		const codec = this.codecs.get(celType);
		if (!codec) {
			return value;
		}

		try {
			return codec.encode(value);
		} catch {
			return value;
		}
	}

	private buildStructCodec(desc: StructCodecDescriptor): AnyCodec {
		const { ctor, fieldNames, fieldTypes } = desc;

		// Build a transform that accepts array (positional) or object input
		return z.unknown().transform((input) => {
			let data: Record<string, unknown>;

			if (Array.isArray(input)) {
				// Positional multi-return from viem
				data = Object.fromEntries(
					fieldNames.map((name, i) => [
						name,
						this.decodeField(
							fieldTypes[name] ?? "dyn",
							(input as unknown[])[i],
						),
					]),
				);
			} else {
				// Named-field object
				const raw = input as Record<string, unknown>;
				data = Object.fromEntries(
					fieldNames.map((name) => [
						name,
						this.decodeField(fieldTypes[name] ?? "dyn", raw[name]),
					]),
				);
			}

			// eslint-disable-next-line new-cap
			return Object.assign(new ctor(), data);
		});
	}

	private decodeField(celType: string, value: unknown): unknown {
		return this.resolve(celType).parse(value);
	}
}
