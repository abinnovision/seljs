import createDebug from "debug";

/**
 * Creates a namespaced debug logger for a SEL module.
 *
 * Enable via the `DEBUG` environment variable:
 * - `DEBUG=sel:*`           — all SEL logging
 * - `DEBUG=sel:evaluate`    — only evaluate flow
 * - `DEBUG=sel:execute:*`   — all execution sub-loggers
 *
 * @param namespace - Module namespace (e.g. "evaluate", "execute:round")
 */
export const createLogger = (namespace: string): createDebug.Debugger =>
	createDebug(`sel:${namespace}`);
