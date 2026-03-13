/**
 * Generates the CEL type name for a contract.
 *
 * @param contractName Raw name of the contract.
 */
export const contractTypeName = (contractName: string): string =>
	`SEL_Contract_${contractName}`;

/**
 * Generates the CEL type name for a struct return type.
 *
 * @param contractName Raw name of the contract.
 * @param functionName Raw name of the method.
 */
export const structTypeName = (
	contractName: string,
	functionName: string,
): string => `SEL_Struct_${contractName}_${functionName}`;
