const LOGICAL_OPERATORS = new Set(["&&", "||"]);
const ARITHMETIC_OPERATORS = new Set(["+", "-", "*", "/", "%"]);
const COMPARISON_OPERATORS = new Set(["<", "<=", ">", ">="]);
const EQUALITY_OPERATORS = new Set(["==", "!="]);

/** Types that support arithmetic operators (same-type only). */
const ARITHMETIC_TYPES = new Set(["int", "uint", "double", "sol_int"]);

/** Types that support the + operator for concatenation. */
const CONCATENATION_TYPES = new Set(["string", "list", "bytes"]);

/** Types that support comparison operators (same-type only). */
const COMPARISON_TYPES = new Set([
	"int",
	"uint",
	"double",
	"string",
	"bytes",
	"sol_address",
	"sol_int",
]);

/**
 * Given the type of the left operand and the operator,
 * returns the expected type for the right operand.
 *
 * Based on the registered operators in register-types.ts.
 * Type compatibility is strictly same-type (no implicit coercion).
 *
 * Returns undefined when the type/operator combination is unknown,
 * signaling that no narrowing should occur.
 */
export const expectedTypeForOperator = (
	leftType: string,
	operator: string,
): string | undefined => {
	if (LOGICAL_OPERATORS.has(operator)) {
		return "bool";
	}

	if (ARITHMETIC_OPERATORS.has(operator)) {
		if (ARITHMETIC_TYPES.has(leftType)) {
			return leftType;
		}

		if (operator === "+" && CONCATENATION_TYPES.has(leftType)) {
			return leftType;
		}

		return undefined;
	}

	if (COMPARISON_OPERATORS.has(operator)) {
		return COMPARISON_TYPES.has(leftType) ? leftType : undefined;
	}

	if (EQUALITY_OPERATORS.has(operator)) {
		return leftType;
	}

	return undefined;
};

/**
 * Check if a candidate type is compatible with an expected type.
 * "dyn" is a wildcard — compatible with anything in either direction.
 */
export const isTypeCompatible = (
	candidateType: string,
	expectedType: string,
): boolean => {
	if (expectedType === "dyn" || candidateType === "dyn") {
		return true;
	}

	return candidateType === expectedType;
};
