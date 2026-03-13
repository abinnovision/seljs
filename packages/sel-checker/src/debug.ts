import createDebug from "debug";

export const createLogger = (namespace: string): createDebug.Debugger =>
	createDebug(`sel:checker:${namespace}`);
