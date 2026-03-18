import type { SELCheckerOptions } from "@seljs/checker";
import type { SELSchema } from "@seljs/schema";

export interface SELEditorFeatures {
	/**
	 * Enable linting/validation
	 *
	 * @default true
	 */
	linting?: boolean;

	/**
	 * Enable schema-aware autocomplete
	 *
	 * @default true
	 */
	autocomplete?: boolean;

	/**
	 * Enable schema-aware identifier coloring
	 *
	 * @default true
	 */
	semanticHighlighting?: boolean;

	/**
	 * Show inferred output type panel below editor
	 *
	 * @default false
	 */
	typeDisplay?: boolean;

	/**
	 * Editor view configuration (always enabled)
	 */
	view?: {
		/**
		 * Minimum number of visible lines
		 *
		 * @default 1
		 */
		minLines?: number;
	};

	/**
	 * Tooltip rendering configuration (always enabled)
	 */
	tooltip?: {
		/**
		 * CSS positioning strategy for tooltips
		 *
		 * @default "fixed"
		 */
		position?: "fixed" | "absolute";

		/**
		 * Custom parent element for tooltip rendering.
		 * Useful when the editor is inside a modal or overflow container.
		 */
		parent?: HTMLElement;
	};
}

export interface SELEditorConfig {
	/**
	 * Container element to mount into
	 */
	parent: HTMLElement;

	/**
	 * Schema driving autocomplete and syntax highlighting
	 */
	schema: SELSchema;

	/**
	 * Initial expression value
	 */
	value?: string;

	/**
	 * Called on every expression change with the current value and validity
	 */
	onChange?: (value: string, valid: boolean) => void;

	/**
	 * Options for the internal SELChecker instance
	 */
	checkerOptions?: SELCheckerOptions;

	/**
	 * Dark mode
	 *
	 * @default false
	 */
	dark?: boolean;

	/**
	 * Whether the editor is read-only
	 * @default false
	 */
	readOnly?: boolean;

	/**
	 * Placeholder text
	 */
	placeholder?: string;

	/**
	 * Optional feature toggles
	 */
	features?: SELEditorFeatures;
}
