/**
 * Shared interface for Solidity wrapper types (UInt256, Int256, Address).
 *
 * These wrappers are registered on the CEL environment via `registerType` so
 * that cel-js's constructor-based type matching (`objectTypesByConstructor`)
 * can identify runtime values as custom Solidity types rather than native JS
 * primitives (BigInt → "int", string → "string").
 */
export interface TypeWrapper<T> {
	readonly value: T;
	valueOf: () => T;
}
