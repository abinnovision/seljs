import { type Abi, AbiFunction } from "ox";

import { decodeRevertData } from "./decode-revert.js";
import { createLogger } from "../debug.js";
import { MulticallBatchError } from "../errors/index.js";

import type { MulticallBatcher } from "./multicall-batcher.js";
import type { MulticallCall } from "./multicall.js";
import type { ResultCache } from "./result-cache.js";
import type { ExecutionContext } from "./types.js";
import type { CallArgument, ExecutionRound } from "../analysis/types.js";

const debug = createLogger("execute:round");

export interface ContractInfo {
	abi: Abi.Abi;
	address: `0x${string}`;
}

export class RoundExecutor {
	public constructor(
		private readonly contracts: Map<string, ContractInfo>,
		private readonly cache: ResultCache,
		private readonly batcher: MulticallBatcher,
	) {}

	public async executeRound(
		round: ExecutionRound,
		context: ExecutionContext,
	): Promise<void> {
		const encodedCalls: MulticallCall[] = [];
		let failedCallIndex: number | undefined;
		let failedCallContract: string | undefined;
		let failedCallMethod: string | undefined;

		try {
			for (const [i, call] of round.calls.entries()) {
				failedCallIndex = i;
				failedCallContract = call.contract;
				failedCallMethod = call.method;

				const contract = this.contracts.get(call.contract);
				if (!contract) {
					throw new Error(`No ABI registered for contract "${call.contract}"`);
				}

				const resolvedArgs = this.resolveArgs(call.args, context);
				encodedCalls.push({
					target: contract.address,
					allowFailure: true,
					callData: AbiFunction.encodeData(
						contract.abi,
						call.method,
						resolvedArgs as readonly unknown[],
					),
				});
			}
		} catch (error) {
			if (error instanceof MulticallBatchError) {
				throw error;
			}

			throw new MulticallBatchError("Failed to encode call", {
				cause: error,
				failedCallIndex,
				contractName: failedCallContract,
				methodName: failedCallMethod,
			});
		}

		debug("encoding %d calls for multicall", encodedCalls.length);
		const results = await this.batcher.executeBatch(
			encodedCalls,
			context.blockNumber,
		);

		for (const [i, call] of round.calls.entries()) {
			const contract = this.contracts.get(call.contract);
			if (!contract) {
				throw new Error(`No ABI registered for contract "${call.contract}"`);
			}

			const result = results[i];
			if (!result?.success) {
				const decoded = decodeRevertData(
					result?.returnData ?? "0x",
					contract.abi,
				);
				const suffix = decoded.reason ? ` — ${decoded.reason}` : "";
				throw new MulticallBatchError(
					`Call failed: ${call.contract}.${call.method}${suffix}`,
					{
						failedCallIndex: i,
						contractName: call.contract,
						methodName: call.method,
						revertReason: decoded.reason,
						revertData: decoded.data,
						decodedError: decoded.decodedError,
					},
				);
			}

			const decoded = AbiFunction.decodeResult(
				contract.abi,
				call.method,
				result.returnData,
			);
			debug("decoded %s.%s -> %o", call.contract, call.method, decoded);
			this.cache.set(call.id, decoded);
		}
	}

	private resolveArgs(
		args: CallArgument[],
		context: ExecutionContext,
	): unknown[] {
		return args.map((arg) => {
			if (arg.type === "literal") {
				return arg.value;
			}

			if (arg.type === "variable") {
				const name = arg.variableName;
				if (!name) {
					return undefined;
				}

				return context.variables[name];
			}

			// arg.type === "call_result"
			const id = arg.dependsOnCallId;
			if (!id) {
				return undefined;
			}

			return this.cache.get(id);
		});
	}
}
