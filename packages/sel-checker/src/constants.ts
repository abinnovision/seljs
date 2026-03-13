/** Comprehension macro names that introduce scoped iteration variables. */
export const COMPREHENSION_MACROS = new Set([
	"map",
	"filter",
	"exists",
	"all",
	"exists_one",
]);

/** Solidity scalar wrapper functions (pass-through for arg classification). */
export const SCALAR_WRAPPER_FUNCTIONS = new Set(["solInt", "solAddress"]);
