/**
 * Represents a contract call found in AST traversal.
 * Contains all information needed to execute the call and track dependencies.
 */
export interface CollectedCall {
	/**
	 * Unique identifier: "contract:method:serializedArgs"
	 */
	id: string;

	/**
	 * Contract name: e.g., "erc20_usdc"
	 */
	contract: string;

	/**
	 * Method name: e.g., "balanceOf"
	 */
	method: string;

	/**
	 * Arguments with type and dependency information
	 */
	args: CallArgument[];

	/**
	 * Reference to original AST node for error reporting
	 */
	astNode: unknown;
}

/**
 * Argument to a contract call with type information.
 * Tracks whether the argument is a literal, variable, or result of another call.
 */
export interface CallArgument {
	/**
	 * Type of argument: literal value, variable reference, or call result
	 */
	type: "literal" | "variable" | "call_result";

	/**
	 * Literal value (when type is "literal")
	 */
	value?: unknown;

	/**
	 * Variable name (when type is "variable")
	 */
	variableName?: string;

	/**
	 * Call ID this depends on (when type is "call_result")
	 */
	dependsOnCallId?: string;
}

/**
 * Dependency graph for all collected calls.
 * Maps call IDs to their nodes and dependency relationships.
 */
export interface DependencyGraph {
	/**
	 * Call ID to graph node mapping
	 */
	nodes: Map<string, GraphNode>;

	/**
	 * Call ID to set of call IDs it depends on
	 */
	edges: Map<string, Set<string>>;
}

/**
 * Single node in the dependency graph.
 * Tracks both incoming and outgoing dependencies.
 */
export interface GraphNode {
	/**
	 * The original collected call
	 */
	call: CollectedCall;

	/**
	 * Call IDs this call depends on (must complete first)
	 */
	dependsOn: string[];

	/**
	 * Call IDs that depend on this call (will execute after)
	 */
	dependedOnBy: string[];
}

/**
 * Execution plan with rounds of parallel calls.
 * Result of topological sorting the dependency graph.
 */
export interface ExecutionPlan {
	/**
	 * Rounds of calls to execute in sequence
	 */
	rounds: ExecutionRound[];

	/**
	 * Total number of calls across all rounds
	 */
	totalCalls: number;

	/**
	 * Number of rounds (maximum dependency depth)
	 */
	maxDepth: number;
}

/**
 * Single round of calls that can execute in parallel.
 * All calls in a round have no dependencies on each other.
 */
export interface ExecutionRound {
	/**
	 * Round number (0-indexed)
	 */
	roundNumber: number;

	/**
	 * Calls that can execute in parallel this round
	 */
	calls: CollectedCall[];
}
