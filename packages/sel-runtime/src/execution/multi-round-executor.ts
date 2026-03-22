import { MulticallBatcher } from "./multicall-batcher.js";
import { ResultCache } from "./result-cache.js";
import { type ContractInfo, RoundExecutor } from "./round-executor.js";
import { createLogger } from "../debug.js";

import type { ExecutionContext, ExecutionResult } from "./types.js";
import type { ExecutionPlan } from "../analysis/types.js";
import type { SELClient } from "../environment/client.js";

const debug = createLogger("execute");

export class MultiRoundExecutor {
	private readonly contracts: Map<string, ContractInfo>;

	public constructor(
		private readonly client: SELClient,
		contracts: Map<string, ContractInfo>,
		private readonly multicallOptions?: {
			address?: `0x${string}`;
			batchSize?: number;
		},
	) {
		this.contracts = contracts;
	}

	public async execute(
		plan: ExecutionPlan,
		variables: Record<string, unknown> = {},
		blockNumber?: bigint,
	): Promise<ExecutionResult> {
		const lockedBlockNumber =
			blockNumber ?? (await this.client.getBlockNumber());

		debug(
			"start: %d rounds, %d calls, block=%s",
			plan.rounds.length,
			plan.totalCalls,
			String(lockedBlockNumber),
		);

		const cache = new ResultCache();
		const batcher = new MulticallBatcher(this.client, this.multicallOptions);
		const executor = new RoundExecutor(this.contracts, cache, batcher);

		const context: ExecutionContext = {
			blockNumber: lockedBlockNumber,
			variables,
		};

		for (const round of plan.rounds) {
			debug("round %d: %d calls", round.roundNumber, round.calls.length);
			await executor.executeRound(round, context);
		}

		const results = new Map<string, unknown>();
		for (const round of plan.rounds) {
			for (const call of round.calls) {
				results.set(call.id, cache.get(call.id));
			}
		}

		debug("complete: %d results collected", results.size);

		return {
			results,
			meta: {
				roundsExecuted: plan.rounds.length,
				totalCalls: plan.totalCalls,
				blockNumber: lockedBlockNumber,
			},
		};
	}
}
