import type { FootprintResult } from "./footprint.js";
import type { SELSchema, TypeRef } from "./types.js";
import type { AbiFunction, AbiParameter } from "abitype";

const canonicalType = (p: AbiParameter): string =>
	"components" in p
		? `(${p.components.map(canonicalType).join(",")})${p.type.slice(5)}`
		: p.type;

const signatureOf = (abi: AbiFunction): string =>
	`${abi.name}(${abi.inputs.map(canonicalType).join(",")})`;

/**
 * Returns a copy of the schema reduced to the footprint: only the referenced
 * contracts and methods, and only the struct types they can reach.
 *
 * @throws Error when the footprint references a contract or method that is not in the schema.
 */
export const pruneSchema = (
	schema: SELSchema,
	footprint: FootprintResult,
): SELSchema => {
	const wantedByContract = new Map(
		footprint.contracts.map((f) => [
			f.name,
			new Set(f.methods.map((m) => m.signature)),
		]),
	);

	for (const name of wantedByContract.keys()) {
		if (!schema.contracts.some((c) => c.name === name)) {
			throw new Error(`Footprint references unknown contract "${name}"`);
		}
	}

	const contracts = schema.contracts.flatMap((c) => {
		const wanted = wantedByContract.get(c.name);

		if (!wanted) {
			return [];
		}

		const methods = c.methods.filter((m) => wanted.has(signatureOf(m.abi)));
		const found = new Set(methods.map((m) => signatureOf(m.abi)));
		const missing = [...wanted].find((sig) => !found.has(sig));

		if (missing) {
			throw new Error(
				`Footprint references unknown method "${c.name}.${missing}"`,
			);
		}

		return [{ ...c, methods }];
	});

	const refs: TypeRef[] = [
		...contracts.flatMap((c) =>
			c.methods.flatMap((m) => [m.returns, ...m.params.map((p) => p.type)]),
		),
		...[...schema.variables, ...(schema.constants ?? [])].map((v) => v.type),
		...schema.functions.flatMap((f) => [
			f.returns,
			...(f.receiverType ? [f.receiverType] : []),
			...f.params.map((p) => p.type),
		]),
	];

	const structs = new Map(
		schema.types.filter((t) => t.kind === "struct").map((t) => [t.name, t]),
	);
	const reachable = new Set<string>();
	const visit = (ref: TypeRef): void => {
		for (const id of ref.match(/[A-Za-z_]\w*/g) ?? []) {
			const struct = structs.get(id);
			if (struct && !reachable.has(id)) {
				reachable.add(id);
				for (const field of struct.fields ?? []) {
					visit(field.type);
				}
			}
		}
	};

	for (const ref of refs) {
		visit(ref);
	}

	return {
		...schema,
		contracts,
		types: schema.types.filter(
			(t) => t.kind !== "struct" || reachable.has(t.name),
		),
	};
};
