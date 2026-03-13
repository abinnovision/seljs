import type { SELDiagnostic } from "../linting/diagnostic-mapper";
import type { Extension } from "@codemirror/state";
import type { SELSchema } from "@seljs/schema";

export interface SELEditorConfig {
	/** Container element to mount into */
	parent: HTMLElement;

	/** Schema driving autocomplete and syntax highlighting */
	schema: SELSchema;

	/** Initial expression value */
	value?: string;

	/** Called on every expression change */
	onChange?: (value: string) => void;

	/** Validation function for error highlighting */
	validate?: (expression: string) => SELDiagnostic[] | Promise<SELDiagnostic[]>;

	/** Debounce delay for validation (default: 300ms) */
	validateDelay?: number;

	/** Dark mode */
	dark?: boolean;

	/** Whether the editor is read-only */
	readOnly?: boolean;

	/** Placeholder text */
	placeholder?: string;

	/** Show inferred output type below the editor */
	showType?: boolean;

	/** Additional CodeMirror extensions */
	extensions?: Extension[];
}
