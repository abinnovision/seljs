import {
	SolidityAddressTypeWrapper,
	SolidityIntTypeWrapper,
} from "@seljs/types";

const wrapFieldValue = (
	registry: Map<string, StructInfo>,
	celType: string,
	value: unknown,
): unknown => {
	const nested = registry.get(celType);
	if (nested) {
		return wrapStructValue(registry, nested, value);
	}

	return wrapValueForSel(celType, value);
};

export interface StructInfo {
	ctor: new () => object;
	fieldNames: string[];
	fieldTypes: Record<string, string>;
}

/**
 * Maps a CEL type to the native CEL literal type for dual function registration.
 */
export const toCelLiteralType = (celType: string): string | null => {
	if (celType === "sol_int") {
		return "int";
	}

	if (celType === "sol_address") {
		return "string";
	}

	return null;
};

/**
 * Wraps a raw value into the corresponding SEL wrapper type.
 */
export const wrapValueForSel = (celType: string, value: unknown): unknown => {
	if (value instanceof SolidityAddressTypeWrapper) {
		return value;
	}

	if (value instanceof SolidityIntTypeWrapper) {
		return value;
	}

	if (celType === "sol_address") {
		return new SolidityAddressTypeWrapper(value);
	}

	if (typeof value === "bigint") {
		return new SolidityIntTypeWrapper(value);
	}

	if (typeof value === "number" && Number.isInteger(value)) {
		return new SolidityIntTypeWrapper(BigInt(value));
	}

	return value;
};

/**
 * Recursively wraps a raw struct value with the correct ctor and wrapped field values.
 */
export const wrapStructValue = (
	registry: Map<string, StructInfo>,
	info: StructInfo,
	value: unknown,
): unknown => {
	const { ctor, fieldNames, fieldTypes } = info;
	let data: Record<string, unknown>;

	if (Array.isArray(value)) {
		data = Object.fromEntries(
			fieldNames.map((name, i) => [
				name,
				wrapFieldValue(
					registry,
					fieldTypes[name] ?? "dyn",
					(value as unknown[])[i],
				),
			]),
		);
	} else {
		const raw = value as Record<string, unknown>;
		data = Object.fromEntries(
			Object.entries(raw).map(([name, val]) => [
				name,
				fieldTypes[name]
					? wrapFieldValue(registry, fieldTypes[name], val)
					: val,
			]),
		);
	}

	// eslint-disable-next-line new-cap
	return Object.assign(new ctor(), data);
};
