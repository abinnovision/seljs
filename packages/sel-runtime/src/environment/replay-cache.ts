import type { CallArgument, CollectedCall } from "../analysis/types.js";
import type { CelCodecRegistry } from "@seljs/checker";

const resolveReplayArgs = (
	args: CallArgument[],
	variables: Record<string, unknown>,
	results: Map<string, unknown>,
	paramTypes: string[],
	codecRegistry: CelCodecRegistry,
	// eslint-disable-next-line max-params
): unknown[] =>
	args.map((arg, i) => {
		const celType = paramTypes[i] ?? "dyn";
		if (arg.type === "literal") {
			return codecRegistry.encode(celType, arg.value);
		}

		if (arg.type === "variable") {
			const name = arg.variableName;
			if (!name) {
				return undefined;
			}

			return codecRegistry.encode(celType, variables[name]);
		}

		const id = arg.dependsOnCallId;
		if (!id) {
			return undefined;
		}

		return codecRegistry.encode(celType, results.get(id));
	});

/**
 * Builds a replay cache that maps unique identifiers for contract calls to their results.
 * This allows for efficient retrieval of results during execution replay, ensuring that the same inputs yield the same outputs without needing to re-execute the calls.
 *
 * @param calls An array of collected contract calls, each containing information about the contract, method, arguments, and dependencies.
 * @param results A map of call IDs to their corresponding results, which will be used to resolve arguments that depend on previous calls.
 * @param variables A record of variable names to their values, which will be used to resolve arguments that depend on variables.
 */
export const buildExecutionReplayCache = (
	calls: CollectedCall[],
	results: Map<string, unknown>,
	variables: Record<string, unknown>,
	codecRegistry: CelCodecRegistry,
	getParamTypes: (contract: string, method: string) => string[],
	// eslint-disable-next-line max-params
): Map<string, unknown> => {
	const replayCache = new Map<string, unknown>();

	for (const call of calls) {
		const result = results.get(call.id);
		const paramTypes = getParamTypes(call.contract, call.method);
		const resolvedArgs = resolveReplayArgs(
			call.args,
			variables,
			results,
			paramTypes,
			codecRegistry,
		);
		const replayCallId = createReplayCallId(
			call.contract,
			call.method,
			resolvedArgs,
		);
		replayCache.set(replayCallId, result);
	}

	return replayCache;
};

/**
 * Creates a unique identifier for a contract call based on contract name,
 * method, and arguments.
 *
 * IMPORTANT: Args must be pre-encoded via codecRegistry.encode() before
 * calling this function. The encode step normalizes types (e.g., sol_int
 * always produces bigint, sol_address always produces string), which
 * prevents type collisions in String() serialization. If args are NOT
 * pre-encoded, String(42n) === String(42) would cause cache key collisions.
 */
export const createReplayCallId = (
	contract: string,
	method: string,
	args: unknown[],
): string => {
	const argKey = args.map((arg) => String(arg)).join(",");

	return `${contract}:${method}:${argKey}`;
};
