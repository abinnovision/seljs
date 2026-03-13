import type { Completion } from "@codemirror/autocomplete";
import type {
	ContractSchema,
	FunctionSchema,
	MacroSchema,
	VariableSchema,
} from "@seljs/schema";

export const createContractCompletions = (
	contracts: ContractSchema[],
): Completion[] =>
	contracts.map((c) => ({
		label: c.name,
		type: "class" as const,
		detail: c.description,
	}));

export const createMethodCompletions = (
	contract: ContractSchema,
): Completion[] =>
	contract.methods.map((m) => ({
		label: m.name,
		type: "method" as const,
		detail: `(${m.params.map((p) => `${p.name}: ${p.type}`).join(", ")}): ${m.returns}`,
		info: m.description,
	}));

export const createFunctionCompletions = (
	functions: FunctionSchema[],
): Completion[] =>
	functions.map((f) => ({
		label: f.name,
		type: "function" as const,
		detail: f.signature,
		info: f.description,
	}));

export const createMacroCompletions = (macros: MacroSchema[]): Completion[] =>
	macros.map((m) => ({
		label: m.name,
		type: "keyword" as const,
		detail: m.pattern,
		info: m.description,
	}));

export const createVariableCompletions = (
	variables: VariableSchema[],
): Completion[] =>
	variables.map((v) => ({
		label: v.name,
		type: "variable" as const,
		detail: v.type,
		info: v.description,
	}));
