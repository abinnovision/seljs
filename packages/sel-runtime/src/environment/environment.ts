import { SELChecker, createRuntimeEnvironment } from "@seljs/checker";

import { getBuiltinContracts } from "./builtin-contracts.js";
import { validateClient } from "./client.js";
import { normalizeContextForEvaluation } from "./context.js";
import {
	CallCounter,
	buildContractInfoMap,
	executeContractCall,
	resolveExecutionBlockNumber,
} from "./contract-caller.js";
import { wrapError } from "./error-wrapper.js";
import { buildExecutionReplayCache } from "./replay-cache.js";
import { collectCalls } from "../analysis/call-collector.js";
import { analyzeDependencies } from "../analysis/dependency-analyzer.js";
import { planRounds } from "../analysis/round-planner.js";
import { createLogger } from "../debug.js";
import {
	SELContractError,
	SELContractRevertError,
	SELLintError,
	SELMulticallBatchError,
} from "../errors/index.js";
import { MultiRoundExecutor } from "../execution/multi-round-executor.js";

import type { SELClient } from "./client.js";
import type { MulticallOptions, SELRuntimeConfig } from "./types.js";
import type { CollectedCall } from "../analysis/types.js";
import type {
	EvaluateOptions,
	EvaluateResult,
	ExecutionMeta,
} from "../execution/types.js";
import type { Environment, TypeCheckResult } from "@marcbachmann/cel-js";
import type { CelCodecRegistry, SELDiagnostic } from "@seljs/checker";
import type { ContractSchema, SELSchema } from "@seljs/schema";

/**
 * Core SEL runtime that bridges CEL expression evaluation with EVM contract reads.
 *
 * Manages a CEL runtime extended with Solidity primitive types (uint256, address, bool, etc.),
 * registered smart contracts whose view functions become callable in expressions, and typed
 * variables that are supplied at evaluation time. Contract calls are automatically batched
 * via multicall3 and executed in dependency-ordered rounds.
 */
const debug = createLogger("environment");

export class SELRuntime {
	private readonly env: Environment;
	private readonly checker: SELChecker;
	private readonly client?: SELClient;
	private readonly schema: SELSchema;
	private readonly variableTypes = new Map<string, string>();
	private readonly maxRounds: number;
	private readonly maxCalls: number;
	private readonly multicallOptions?: MulticallOptions;
	private readonly contractBindings: Record<string, unknown>;
	private readonly codecRegistry: CelCodecRegistry;

	/**
	 * Per-evaluation mutable state.
	 *
	 * These fields are set before CEL evaluation and cleared in `finally`.
	 * They exist because the contract call handler closure (created in the
	 * constructor) needs access to per-evaluation context, but CEL's
	 * `Environment.parse()` returns a function that doesn't accept extra
	 * parameters beyond the variable bindings.
	 *
	 * Thread safety: The `mutex` field serializes concurrent `evaluate()`
	 * calls, ensuring these fields are never accessed concurrently.
	 *
	 * TODO: Consider refactoring to pass an EvaluationContext object through
	 * the handler closure instead of mutating instance state. This would
	 * eliminate the need for the mutex and make the code more testable.
	 * See .omc/drafts/context-object-spike.md for preliminary analysis.
	 */
	private currentCache?: Map<string, unknown>;
	private currentClient?: SELClient;
	private currentCallCounter?: CallCounter;

	/** Mutex to serialize concurrent evaluate() calls (protects current* fields) */
	private mutex = Promise.resolve();

	/**
	 * Creates a new immutable SEL runtime with Solidity types pre-registered.
	 *
	 * Initializes the underlying CEL runtime, registers all Solidity primitive types,
	 * and processes any contracts and variables from the schema. After construction,
	 * the environment is fully configured and immutable.
	 *
	 * @param config - Configuration containing the SEL schema, optional viem client,
	 *   multicall settings, and CEL/execution limits (maxRounds defaults to 10, maxCalls to 100)
	 */
	public constructor(config: SELRuntimeConfig) {
		const limits = config.limits;
		this.maxRounds = limits?.maxRounds ?? 10;
		this.maxCalls = limits?.maxCalls ?? 100;
		this.multicallOptions = config.multicall;
		if (config.client) {
			validateClient(config.client);
		}

		this.client = config.client;

		// Augment user schema with built-in contracts (e.g., __multicall3 for address accessors)
		this.schema = {
			...config.schema,
			contracts: [
				...config.schema.contracts,
				...getBuiltinContracts(config.multicall),
			],
		};

		// Build handler closure that captures `this` for contract execution
		const handler = (
			contractName: string,
			methodName: string,
			args: unknown[],
		): unknown => {
			const resolved = this.resolveCall(contractName, methodName, args);

			const contract = this.findContract(resolved.contractName);
			if (!contract) {
				throw new SELContractError(
					`Unknown contract "${resolved.contractName}"`,
					{ contractName: resolved.contractName },
				);
			}

			const method = contract.methods.find(
				(m) => m.name === resolved.methodName,
			);
			if (!method) {
				throw new SELContractError(
					`Unknown method "${resolved.contractName}.${resolved.methodName}"`,
					{
						contractName: resolved.contractName,
						methodName: resolved.methodName,
					},
				);
			}

			return executeContractCall(contract, method, resolved.args, {
				executionCache: this.currentCache,
				client: this.currentClient ?? this.client,
				codecRegistry: this.codecRegistry,
				callCounter: this.currentCallCounter,
			});
		};

		// Create environment via unified hydration
		const { env, contractBindings, codecRegistry } = createRuntimeEnvironment(
			this.schema,
			handler,
		);

		this.env = env;
		this.contractBindings = contractBindings;
		this.codecRegistry = codecRegistry;

		this.checker = new SELChecker(config.schema, {
			rules: config.rules,
		});

		// Populate variableTypes from schema for normalizeContextForEvaluation
		for (const v of this.schema.variables) {
			this.variableTypes.set(v.name, v.type);
		}
	}

	/**
	 * Type-checks an expression against registered variables and contract methods.
	 *
	 * @param expression - A CEL expression string to type-check
	 * @returns The type-check result containing validity, inferred type, and any errors
	 * @throws {@link SELParseError} If the expression cannot be parsed
	 * @throws {@link SELTypeCheckError} If the CEL type-checker rejects the expression
	 * @throws {@link SELLintError} If lint rules with error severity match
	 */
	public check(expression: string): TypeCheckResult {
		try {
			return this.env.check(expression);
		} catch (error) {
			throw wrapError(error);
		}
	}

	/**
	 * Evaluates a SEL expression, executing any embedded contract calls on-chain.
	 *
	 * When contract calls are present, the full pipeline runs:
	 * 1. Parse the expression and collect contract calls from the AST
	 * 2. Type-check against registered variables and contract methods
	 * 3. Build a dependency graph and plan execution rounds
	 * 4. Execute contract calls via multicall3 batching at a pinned block number
	 * 5. Evaluate the CEL expression with resolved contract results and context values
	 * 6. Unwrap Solidity wrapper types back to native JS values (BigInt, string, etc.)
	 *
	 * @param expression A CEL expression string
	 * @param context Variable bindings for evaluation
	 * @param options Optional client override
	 * @returns An {@link EvaluateResult} containing the value and optional execution metadata
	 * @throws {@link SELParseError} If the expression cannot be parsed
	 * @throws {@link SELTypeCheckError} If the CEL type-checker rejects the expression
	 * @throws {@link SELLintError} If lint rules with error severity match
	 * @throws {@link SELConfigError} If an ABI / codec registry entry is missing
	 * @throws {@link SELContractError} If a contract call fails (non-revert)
	 * @throws {@link SELContractRevertError} If a contract call reverted
	 * @throws {@link SELMulticallBatchError} If the Multicall3 batch itself failed
	 * @throws {@link SELProviderTransportError} If the JSON-RPC transport failed
	 * @throws {@link SELProviderRpcError} If the node returned a JSON-RPC error
	 * @throws {@link SELExecutionLimitError} If maxRounds / maxCalls were exceeded
	 * @throws {@link SELCircularDependencyError} If the call graph has a cycle
	 * @throws {@link SELEvaluationError} If CEL evaluation fails
	 * @throws {@link SELTypeConversionError} If a Solidity type wrapper rejected an input
	 */
	public async evaluate<T = unknown>(
		expression: string,
		context?: Record<string, unknown>,
		options?: EvaluateOptions,
	): Promise<EvaluateResult<T>> {
		let release: () => void;
		const prev = this.mutex;
		this.mutex = new Promise<void>((resolve) => {
			release = resolve;
		});

		await prev;

		try {
			return await this.doEvaluate<T>(expression, context, options);
		} finally {
			// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
			release!();
		}
	}

	private planExecution(
		expression: string,
		evaluationContext: Record<string, unknown>,
	): {
		parseResult: ReturnType<Environment["parse"]>;
		collectedCalls: CollectedCall[];
		normalizedContext: Record<string, unknown> | undefined;
		executionVariables: Record<string, unknown>;
		resolvedType: string | undefined;
		diagnostics: SELDiagnostic[];
	} {
		// Gate: checker validates parse, types, and lint rules
		const checkResult = this.checker.check(expression);

		if (!checkResult.valid) {
			const errorDiags = checkResult.diagnostics.filter(
				(d) => d.severity === "error",
			);
			throw new SELLintError(errorDiags);
		}

		// Expression is valid — parse for execution (runtime env with contract bindings)
		const parseResult = this.env.parse(expression);

		const collectedCalls = collectCalls(parseResult.ast, {
			get: (name: string) => this.findContract(name),
		});

		debug("evaluate: collected %d calls", collectedCalls.length);

		const normalizedContext = Object.keys(evaluationContext).length
			? normalizeContextForEvaluation(
					evaluationContext,
					this.variableTypes,
					this.codecRegistry,
				)
			: undefined;

		const executionVariables = Object.keys(evaluationContext).length
			? evaluationContext
			: {};

		// Advisory: warning/info diagnostics pass through to result
		const diagnostics = checkResult.diagnostics.filter(
			(d) => d.severity !== "error",
		);

		return {
			parseResult,
			collectedCalls,
			normalizedContext,
			executionVariables,
			resolvedType: checkResult.type,
			diagnostics,
		};
	}

	private async executeContractCalls(
		collectedCalls: CollectedCall[],
		executionVariables: Record<string, unknown>,
		resolvedClient: SELClient,
	): Promise<{
		executionMeta: ExecutionMeta;
		executionCache: Map<string, unknown>;
	}> {
		debug(
			"evaluate: calls to execute — %o",
			collectedCalls.map((c) => `${c.contract}.${c.method}`),
		);

		const graph = analyzeDependencies(collectedCalls);
		const plan = planRounds(graph, {
			maxRounds: this.maxRounds,
			maxCalls: this.maxCalls,
		});

		// Schema already includes builtin contracts (__multicall3 etc.)
		const contractInfoMap = buildContractInfoMap(this.schema.contracts);

		const executor = new MultiRoundExecutor(
			resolvedClient,
			contractInfoMap,
			this.multicallOptions,
		);

		let executionResult: {
			results: Map<string, unknown>;
			meta: ExecutionMeta;
		};

		try {
			executionResult = await executor.execute(
				plan,
				executionVariables,
				await resolveExecutionBlockNumber(resolvedClient),
			);
		} catch (error) {
			// Per-call reverts already carry full context — pass through.
			if (error instanceof SELContractRevertError) {
				throw error;
			}

			let failedCall = collectedCalls[0];
			if (error instanceof SELMulticallBatchError) {
				if (error.contractName && error.methodName) {
					const contractName: string = error.contractName;
					const methodName: string = error.methodName;
					const base = failedCall ?? {
						id: "",
						contract: contractName,
						method: methodName,
						args: [],
						astNode: undefined,
					};

					failedCall = {
						...base,
						contract: contractName,
						method: methodName,
					};
				} else if (typeof error.failedCallIndex === "number") {
					failedCall = collectedCalls[error.failedCallIndex] ?? failedCall;
				}
			}

			if (!failedCall) {
				throw error;
			}

			throw new SELContractError(
				`Contract call failed: ${failedCall.contract}.${failedCall.method}`,
				{
					cause: error,
					contractName: failedCall.contract,
					methodName: failedCall.method,
				},
			);
		}

		const executionMeta = executionResult.meta;
		const executionCache = buildExecutionReplayCache(
			collectedCalls,
			executionResult.results,
			executionVariables,
			this.codecRegistry,
			(contract, method) => {
				const c = this.findContract(contract);
				const m = c?.methods.find((m) => m.name === method);

				return m?.params.map((p) => p.type) ?? [];
			},
		);

		return { executionMeta, executionCache };
	}

	private async doEvaluate<T = unknown>(
		expression: string,
		context?: Record<string, unknown>,
		options?: EvaluateOptions,
	): Promise<EvaluateResult<T>> {
		debug("evaluate: %s", expression);

		const resolvedClient = options?.client ?? this.client;
		if (resolvedClient && resolvedClient !== this.client) {
			validateClient(resolvedClient);
		}

		try {
			const {
				parseResult,
				collectedCalls,
				normalizedContext,
				executionVariables,
				resolvedType,
				diagnostics,
			} = this.planExecution(expression, context ?? {});

			let executionMeta: ExecutionMeta | undefined;
			let executionCache: Map<string, unknown> | undefined;

			if (collectedCalls.length > 0) {
				if (!resolvedClient) {
					throw new SELContractError(
						"No client provided for contract call. Provide a client in SELRuntime config or evaluate() options.",
						{
							contractName: collectedCalls[0]?.contract,
							methodName: collectedCalls[0]?.method,
						},
					);
				}

				({ executionMeta, executionCache } = await this.executeContractCalls(
					collectedCalls,
					executionVariables,
					resolvedClient,
				));
			}

			// Set per-evaluation state for the handler closure
			this.currentCache = executionCache;
			this.currentClient = resolvedClient;
			this.currentCallCounter = new CallCounter(
				this.maxCalls,
				executionMeta?.totalCalls ?? 0,
			);

			let result: unknown;
			try {
				result = await (parseResult({
					...normalizedContext,
					...this.contractBindings,
				}) as Promise<unknown>);
			} finally {
				this.currentCache = undefined;
				this.currentClient = undefined;
				this.currentCallCounter = undefined;
			}

			const value = (
				resolvedType ? this.codecRegistry.encode(resolvedType, result) : result
			) as T;

			debug("evaluate: result type=%s", typeof value);

			const evalResult: EvaluateResult<T> = executionMeta
				? { value, meta: executionMeta }
				: { value };

			if (resolvedType) {
				evalResult.type = resolvedType;
			}

			if (diagnostics.length > 0) {
				evalResult.diagnostics = diagnostics;
			}

			return evalResult;
		} catch (error) {
			throw wrapError(error);
		}
	}

	/**
	 * Remaps receiver method calls to their underlying contract calls.
	 * e.g., sol_address.balance() → __multicall3.getEthBalance(addr)
	 */
	private resolveCall(
		contractName: string,
		methodName: string,
		args: unknown[],
	): { contractName: string; methodName: string; args: unknown[] } {
		if (contractName === "sol_address" && methodName === "balance") {
			return {
				contractName: "__multicall3",
				methodName: "getEthBalance",
				args,
			};
		}

		return { contractName, methodName, args };
	}

	private findContract(name: string): ContractSchema | undefined {
		return this.schema.contracts.find((c) => c.name === name);
	}
}
