import { structTypeName } from "@seljs/common";
import { mapSolidityTypeToCEL } from "@seljs/types";

import {
	CEL_BUILTIN_FUNCTIONS,
	CEL_BUILTIN_MACROS,
	SOLIDITY_PRIMITIVE_TYPES,
} from "./builtins.js";
import { getFeatureDefinition } from "./feature-registry.js";

import type {
	FunctionSchema,
	MethodSchema,
	ParamSchema,
	SELFeatureConfig,
	SELSchema,
	TypeSchema,
	VariableSchema,
} from "@seljs/schema";
import type {
	ContextCelType,
	ContextDefinition,
	ContextFieldDefinition,
} from "@seljs/types";
import type { AbiParameter } from "abitype";
import type { Abi, AbiFunction, Address } from "viem";

interface StructTypeDefinition {
	typeName: string;
	fields: Record<string, string>;
}

interface BuildStructFieldsResult {
	fields: Record<string, string>;
	nestedTypes: StructTypeDefinition[];
}

interface MethodReturnResolution {
	returns: string;
	structTypes: TypeSchema[];
}

interface StructAccumulator {
	seen: Set<string>;
	types: TypeSchema[];
}

/**
 * Checks if the given ABI parameter is a tuple type with components, indicating that it represents a struct in Solidity.
 * @param param
 */
const isTupleParam = (
	param: AbiParameter,
): param is AbiParameter & { components: readonly AbiParameter[] } =>
	param.type === "tuple" && "components" in param;

/**
 * Checks if the given ABI parameter is an array of tuples with components, indicating that it represents an array of structs in Solidity.
 * @param param
 */
const isTupleArrayParam = (
	param: AbiParameter,
): param is AbiParameter & { components: readonly AbiParameter[] } =>
	param.type === "tuple[]" && "components" in param;

/**
 * Checks if the given ABI parameter is either a tuple or an array of tuples, both of which indicate the presence of components and thus represent struct types in Solidity.
 *
 * @param param
 */
const isAnyTupleParam = (
	param: AbiParameter,
): param is AbiParameter & { components: readonly AbiParameter[] } =>
	isTupleParam(param) || isTupleArrayParam(param);

/**
 * Generates a unique type name for a nested struct based on the parent type name and the field name, used for naming struct types in the SEL schema.
 *
 * @param parentTypeName Name of the parent type (e.g., contract name or parent struct name) to which the field belongs, used as a prefix for the nested struct type name.
 * @param fieldName Name of the field for which to generate the nested struct type name, used as a suffix in the nested struct type name.
 */
const nestedTypeName = (parentTypeName: string, fieldName: string): string =>
	`${parentTypeName}__${fieldName}`;

/**
 * Recursively builds struct field definitions.
 *
 * @param components Array of ABI parameters representing the components of a tuple type.
 * @param parentTypeName Name to use for the struct type representing the current level of nesting.
 */
const buildStructFields = (
	components: readonly AbiParameter[],
	parentTypeName: string,
): BuildStructFieldsResult => {
	const fields: Record<string, string> = {};
	const nestedTypes: StructTypeDefinition[] = [];

	for (const component of components) {
		const fieldName = component.name ?? "arg0";

		if (isTupleParam(component) && component.components.length > 0) {
			const childTypeName = nestedTypeName(parentTypeName, fieldName);
			const child = buildStructFields(component.components, childTypeName);

			nestedTypes.push(...child.nestedTypes);
			nestedTypes.push({ typeName: childTypeName, fields: child.fields });
			fields[fieldName] = childTypeName;
			continue;
		}

		if (isTupleArrayParam(component) && component.components.length > 0) {
			const childTypeName = nestedTypeName(parentTypeName, fieldName);
			const child = buildStructFields(component.components, childTypeName);

			nestedTypes.push(...child.nestedTypes);
			nestedTypes.push({ typeName: childTypeName, fields: child.fields });
			fields[fieldName] = `list<${childTypeName}>`;

			continue;
		}

		// For primitive types, directly map to CEL type or use "dyn" if mapping is not possible.
		fields[fieldName] = mapSolidityTypeToCEL(component.type) ?? "dyn";
	}

	return { fields, nestedTypes };
};

/**
 * Builds method parameters for a given array of ABI parameters.
 *
 * @param inputs Array of ABI parameters representing the inputs of a function.
 */
const buildMethodParams = (inputs: readonly AbiParameter[]): ParamSchema[] => {
	return inputs.map((param, index) => ({
		// eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing -- empty string name means unnamed param
		name: param.name || `arg${String(index)}`,
		type: mapSolidityTypeToCEL(param.type) ?? "dyn",
	}));
};

/**
 * Builds the return type resolution for a method based on its ABI components, handling nested structs as needed.
 *
 * @param components Array of ABI parameters representing the components of a tuple return type.
 * @param typeName Name to use for the struct type representing the return value, used for naming nested struct types as well.
 */
const buildStructReturn = (
	components: readonly AbiParameter[],
	typeName: string,
): MethodReturnResolution => {
	const result = buildStructFields(components, typeName);
	const structTypes: TypeSchema[] = [];

	for (const nested of result.nestedTypes) {
		structTypes.push({
			name: nested.typeName,
			kind: "struct",
			fields: Object.entries(nested.fields).map(([name, type]) => ({
				name,
				type,
			})),
		});
	}

	structTypes.push({
		name: typeName,
		kind: "struct",
		fields: Object.entries(result.fields).map(([name, type]) => ({
			name,
			type,
		})),
	});

	return { returns: typeName, structTypes };
};

/**
 * Resolves the return type of method based on its ABI function definition.
 *
 * @param fn ABI function for which to resolve the return type.
 * @param contractName Name of the contract to which the function belongs, used for naming nested struct types.
 */
const resolveMethodReturnType = (
	fn: AbiFunction,
	contractName: string,
): MethodReturnResolution => {
	const firstOutput = fn.outputs[0];
	if (!firstOutput) {
		return { returns: "dyn", structTypes: [] };
	}

	/*
	 * This is the most basic case:
	 * Single non-tuple return value can be directly mapped to a CEL type without needing to define a struct.
	 */
	if (fn.outputs.length === 1 && !isAnyTupleParam(firstOutput)) {
		const celType = mapSolidityTypeToCEL(firstOutput.type) ?? "dyn";

		return { returns: celType, structTypes: [] };
	}

	const typeName = structTypeName(contractName, fn.name);

	// For more complex cases, we need to define struct types.
	const isSingleOutput = fn.outputs.length === 1;
	const isSingleTupleArray = isSingleOutput && isTupleArrayParam(firstOutput);
	const isSingleTuple = isSingleOutput && isTupleParam(firstOutput);

	let components;
	if (isSingleTuple || isSingleTupleArray) {
		components = firstOutput.components;
	} else {
		components = fn.outputs.map((o, i) => ({
			...o,
			name: o.name ?? `arg${String(i)}`,
		}));
	}

	// Build the struct return type and collect any nested struct types needed for the return value.
	const resolution = buildStructReturn(components, typeName);

	if (isSingleTupleArray) {
		return {
			returns: `list<${typeName}>`,
			structTypes: resolution.structTypes,
		};
	} else {
		return resolution;
	}
};

/**
 * Builds a MethodSchema for a given ABI function.
 *
 * @param fn ABI function for which to build the MethodSchema.
 * @param contractName Name of the contract to which the function belongs, used for naming nested struct types.
 * @param acc Accumulator to keep track of seen struct types and collect unique TypeSchemas for nested structs.
 */
const buildMethodSchema = (
	fn: AbiFunction,
	contractName: string,
	acc: StructAccumulator,
): MethodSchema => {
	const params = buildMethodParams(fn.inputs);

	// Handle the return type resolution.
	const resolution = resolveMethodReturnType(fn, contractName);

	// Add any struct types discovered during return type resolution to the accumulator, ensuring uniqueness.
	for (const st of resolution.structTypes) {
		if (!acc.seen.has(st.name)) {
			acc.types.push(st);
			acc.seen.add(st.name);
		}
	}

	return { name: fn.name, params, returns: resolution.returns, abi: fn };
};

/**
 * Builds a ContractSchema for a given contract by processing its ABI and extracting view/pure functions as methods.
 *
 * @param contractName Name of the contract for which to build the schema.
 * @param input ContractInput containing the ABI and other relevant information for the contract.
 * @param acc Accumulator to keep track of seen struct types and collect unique TypeSchemas for nested structs.
 */
const buildContractSchema = (
	contractName: string,
	input: ContractInput,
	acc: StructAccumulator,
) => {
	// Filter ABI to include only view and pure functions, which are relevant for read-only interactions in the SEL environment.
	const viewFunctions = input.abi.filter(
		(item): item is AbiFunction =>
			item.type === "function" &&
			(item.stateMutability === "view" || item.stateMutability === "pure"),
	);

	const methods = viewFunctions.map((fn) =>
		buildMethodSchema(fn, contractName, acc),
	);

	return {
		name: contractName,
		address: input.address,
		description: input.description,
		methods,
	};
};

/**
 * Resolves a ContextFieldDefinition to its CEL type string.
 */
const resolveFieldType = (field: ContextFieldDefinition): ContextCelType =>
	typeof field === "string" ? field : field.type;

/**
 * Resolves the optional description from a ContextFieldDefinition.
 */
const resolveFieldDescription = (
	field: ContextFieldDefinition,
): string | undefined =>
	typeof field === "string" ? undefined : field.description;

/**
 * Extracts variables from the provided context definition and builds an array of VariableSchema objects.
 */
const buildVariablesFromContext = (
	config: Pick<SchemaBuilderConfig, "context">,
): VariableSchema[] => {
	if (!config.context) {
		return [];
	}

	return Object.entries(config.context).map(([name, field]) => ({
		name,
		type: resolveFieldType(field),
		description: resolveFieldDescription(field),
	}));
};

export interface ContractInput {
	address: Address;
	abi: Abi;
	description?: string;
}

export interface SchemaBuilderConfig {
	contracts?: Record<string, ContractInput>;
	context?: ContextDefinition;
	features?: SELFeatureConfig;
}

/**
 * Builds a SELSchema based on the provided configuration, which includes contract definitions and an optional context for variables.
 *
 * @param config Configuration object containing contract definitions and an optional context for variables.
 * @returns A SELSchema object representing the schema for the SEL environment.
 */
export const buildSchema = (config: SchemaBuilderConfig): SELSchema => {
	const acc: StructAccumulator = { seen: new Set(), types: [] };

	const contracts = Object.entries(config.contracts ?? {}).map(
		([name, input]) => buildContractSchema(name, input, acc),
	);

	const contextVariables = buildVariablesFromContext(config);
	const contextVariableNames = new Set(contextVariables.map((v) => v.name));

	// Merge enabled feature contributions
	const featureVariables: VariableSchema[] = [];
	const featureFunctions: FunctionSchema[] = [];
	const featureTypes: TypeSchema[] = [];
	const enabledFeatures: string[] = [];

	if (config.features) {
		for (const [name, value] of Object.entries(config.features)) {
			if (!value) {
				continue;
			}

			const definition = getFeatureDefinition(name);
			if (!definition) {
				continue;
			}

			enabledFeatures.push(name);

			// Variables: skip if name collides with user-defined context
			if (definition.variables) {
				for (const variable of definition.variables) {
					if (!contextVariableNames.has(variable.name)) {
						featureVariables.push({ ...variable, feature: name });
					}
				}
			}

			if (definition.functions) {
				for (const fn of definition.functions) {
					featureFunctions.push({ ...fn, feature: name });
				}
			}

			if (definition.types) {
				for (const type of definition.types) {
					featureTypes.push({ ...type, feature: name });
				}
			}
		}
	}

	const schema: SELSchema = {
		version: "1.0.0",
		contracts,
		variables: [...contextVariables, ...featureVariables],
		types: [...SOLIDITY_PRIMITIVE_TYPES, ...acc.types, ...featureTypes],
		functions: [...CEL_BUILTIN_FUNCTIONS, ...featureFunctions],
		macros: CEL_BUILTIN_MACROS,
	};

	if (enabledFeatures.length > 0) {
		schema.enabledFeatures = enabledFeatures;
	}

	return schema;
};
