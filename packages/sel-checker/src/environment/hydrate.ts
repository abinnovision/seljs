import { Environment } from "@marcbachmann/cel-js";
import { contractTypeName } from "@seljs/common";

import { createLogger } from "../debug.js";
import { CelCodecRegistry } from "./codec-registry.js";
import { registerSolidityTypes } from "./register-types.js";
import { toCelLiteralType } from "./value-wrappers.js";

import type { StructInfo } from "./value-wrappers.js";
import type { SELSchema } from "@seljs/schema";

const debug = createLogger("hydrate");

/**
 * Hydrate a CEL environment with types, contracts, variables, and functions
 * from a SELSchema. When a handler is provided, contract methods are wired
 * to call it at runtime; otherwise no-op handlers are used (checker mode).
 */
interface HydrationResult {
	contractBindings: Record<string, unknown>;
	codecRegistry?: CelCodecRegistry;
}

const hydrateEnvironment = (
	env: Environment,
	schema: SELSchema,
	handler?: ContractCallHandler,
): HydrationResult => {
	const contractBindings: Record<string, unknown> = {};
	const structRegistry = new Map<string, StructInfo>();

	// Register struct types from schema (nested types appear before parents)
	for (const type of schema.types) {
		if (type.kind === "struct" && type.fields) {
			const fields: Record<string, string> = {};
			for (const field of type.fields) {
				fields[field.name] = field.type;
			}

			try {
				if (handler !== undefined) {
					// Runtime mode: register WITH ctor so structs can be instantiated
					// eslint-disable-next-line @typescript-eslint/no-extraneous-class
					const StructCtor = class {};
					env.registerType(type.name, { ctor: StructCtor, fields });
					structRegistry.set(type.name, {
						ctor: StructCtor,
						fieldNames: Object.keys(fields),
						fieldTypes: fields,
					});
				} else {
					// Checker mode: no ctor needed
					env.registerType(type.name, { fields });
				}
			} catch (err) {
				debug("skipped type %s: %O", type.name, err);
			}
		}
	}

	const codecRegistry =
		handler !== undefined
			? new CelCodecRegistry({
					structs: Array.from(structRegistry.entries()).map(([name, info]) => ({
						name,
						...info,
					})),
				})
			: undefined;

	// Register contract types and methods
	for (const contract of schema.contracts) {
		const typeName = contractTypeName(contract.name);

		class ContractType {
			public constructor(public readonly name: string) {}
		}

		env
			.registerType(typeName, { ctor: ContractType, fields: {} })
			.registerVariable(contract.name, typeName);

		contractBindings[contract.name] = new ContractType(contract.name);

		/* eslint-disable @typescript-eslint/no-unsafe-argument */
		for (const method of contract.methods) {
			const returnType = method.returns || "dyn";

			const methodHandler =
				handler !== undefined
					? async (...args: unknown[]) => {
							const raw = await handler(
								contract.name,
								method.name,
								args.slice(1),
							);

							if (!codecRegistry) {
								throw new Error(
									"codecRegistry is required when handler is provided",
								);
							}

							return codecRegistry.resolve(returnType).parse(raw);
						}
					: () => undefined;

			// Primary overload with schema param types
			try {
				env.registerFunction(
					{
						name: method.name,
						receiverType: typeName,
						returnType,
						handler: methodHandler,
						params: method.params.map((param) => ({
							name: param.name,
							type: param.type,
						})),
					} as any,
					undefined as any,
				);
			} catch (err) {
				debug("skipped method %s.%s: %O", contract.name, method.name, err);
			}

			// CEL literal type overloads for SolidityInt/SolidityAddress params
			const hasCustomParams = method.params.some(
				(p) => toCelLiteralType(p.type) !== null,
			);
			if (hasCustomParams) {
				try {
					env.registerFunction(
						{
							name: method.name,
							receiverType: typeName,
							returnType,
							handler: methodHandler,
							params: method.params.map((param) => ({
								name: param.name,
								type: toCelLiteralType(param.type) ?? param.type,
							})),
						} as any,
						undefined as any,
					);
				} catch (err) {
					debug(
						"skipped literal overload %s.%s: %O",
						contract.name,
						method.name,
						err,
					);
				}
			}
		}
		/* eslint-enable @typescript-eslint/no-unsafe-argument */
	}

	// Register variables
	for (const variable of schema.variables) {
		try {
			env.registerVariable(variable.name, variable.type);
		} catch (err) {
			debug("variable %s: fallback to dyn: %O", variable.name, err);
			env.registerVariable(variable.name, "dyn");
		}
	}

	// Register schema functions with receiverType for type-checking (and runtime dispatch)
	for (const fn of schema.functions) {
		if (!fn.receiverType) {
			continue;
		}

		/*
		 * In runtime mode, wire receiver functions through the contract call handler
		 * so they can read from the replay cache.
		 *
		 * In checker mode, use a no-op handler (type information only).
		 */
		const fnHandler =
			handler !== undefined
				? async (...args: unknown[]) => {
						const raw = await handler(fn.receiverType!, fn.name, args);
						if (!codecRegistry) {
							throw new Error(
								"codecRegistry is required when handler is provided",
							);
						}

						return codecRegistry.resolve(fn.returns).parse(raw);
					}
				: () => undefined;

		try {
			/* eslint-disable @typescript-eslint/no-unsafe-argument */
			env.registerFunction(
				{
					name: fn.name,
					receiverType: fn.receiverType,
					returnType: fn.returns,
					handler: fnHandler,
					params: fn.params.map((param) => ({
						name: param.name,
						type: param.type,
					})),
				} as any,
				undefined as any,
			);
			/* eslint-enable @typescript-eslint/no-unsafe-argument */
		} catch (err) {
			// Skip functions that are already registered as CEL builtins
			if (
				!(err instanceof Error) ||
				!err.message.includes("overlaps with existing overload")
			) {
				throw err;
			}

			debug("skipped overlapping overload: %O", err);
		}
	}

	return { contractBindings, codecRegistry };
};

/**
 * CEL environment limits configuration.
 */
export interface CelLimits {
	maxAstNodes?: number;
	maxDepth?: number;
	maxListElements?: number;
	maxMapEntries?: number;
	maxCallArguments?: number;
}

/**
 * Handler called when a contract method is invoked at runtime.
 */
export type ContractCallHandler = (
	contractName: string,
	methodName: string,
	args: unknown[],
) => unknown;

/**
 * Create a base CEL environment with Solidity types registered.
 * No contracts, no variables — just the type system.
 *
 * Use this when you need to register contracts and variables yourself
 * (e.g., runtime evaluation with real async handlers).
 */
export const createBaseEnvironment = (options?: {
	limits?: CelLimits;
}): Environment => {
	const env = new Environment({
		unlistedVariablesAreDyn: false,
		...(options?.limits ? { limits: options.limits } : {}),
	});

	registerSolidityTypes(env);

	return env;
};

/**
 * Create a fully hydrated checker environment from a SELSchema.
 *
 * Registers Solidity primitive types, contract types with their methods
 * (using no-op handlers since the checker only needs type information),
 * schema variables, and built-in functions.
 */
export const createCheckerEnvironment = (schema: SELSchema): Environment => {
	const env = createBaseEnvironment();
	hydrateEnvironment(env, schema);

	return env;
};

export interface RuntimeEnvironmentResult {
	env: Environment;
	contractBindings: Record<string, unknown>;
	codecRegistry: CelCodecRegistry;
}

/**
 * Create a fully hydrated runtime environment from a SELSchema with a
 * real async handler for contract method calls.
 */
export const createRuntimeEnvironment = (
	schema: SELSchema,
	handler: ContractCallHandler,
	options?: { limits?: CelLimits; unlistedVariablesAreDyn?: boolean },
): RuntimeEnvironmentResult => {
	const env = new Environment({
		unlistedVariablesAreDyn: options?.unlistedVariablesAreDyn ?? false,
		...(options?.limits ? { limits: options.limits } : {}),
	});
	registerSolidityTypes(env);
	const result = hydrateEnvironment(env, schema, handler);
	if (!result.codecRegistry) {
		throw new Error("codecRegistry is required when handler is provided");
	}

	return {
		env,
		contractBindings: result.contractBindings,
		codecRegistry: result.codecRegistry,
	};
};
