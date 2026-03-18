import {
	createSELEditor,
	type EditorView,
	type SELEditorConfig,
} from "@seljs/editor";
import { useCallback, useEffect, useRef, useState } from "react";

import type { RefCallback } from "react";

export interface UseSELEditorResult {
	ref: (node: HTMLElement | null) => void;
	view: EditorView | null;
	value: string;
	valid: boolean;
}

export function useSELEditor(
	config: Omit<SELEditorConfig, "parent">,
): UseSELEditorResult {
	const viewRef = useRef<EditorView | null>(null);
	const [parent, setParent] = useState<HTMLElement | null>(null);
	const [view, setView] = useState<EditorView | null>(null);
	const [value, setValue] = useState(config.value ?? "");
	const [valid, setValid] = useState(true);
	const configRef = useRef(config);
	configRef.current = config;

	const ref = useCallback<RefCallback<HTMLElement>>((node) => {
		setParent(node);
	}, []);

	useEffect(() => {
		if (!parent) {
			if (viewRef.current) {
				viewRef.current.destroy();
				viewRef.current = null;
				setView(null);
			}

			return;
		}

		if (viewRef.current) {
			viewRef.current.destroy();
			viewRef.current = null;
		}

		const currentConfig = configRef.current;
		const editor = createSELEditor({
			...currentConfig,
			parent,
			onChange: (newValue, isValid) => {
				setValue(newValue);
				setValid(isValid);
				currentConfig.onChange?.(newValue, isValid);
			},
		});
		viewRef.current = editor;
		setView(editor);

		return () => {
			editor.destroy();
			viewRef.current = null;
			setView(null);
		};
	}, [
		parent,
		config.schema,
		config.dark,
		config.readOnly,
		config.placeholder,
		config.checkerOptions,
		config.features?.linting,
		config.features?.autocomplete,
		config.features?.semanticHighlighting,
		config.features?.typeDisplay,
		config.features?.view?.minLines,
		config.features?.tooltip?.parent,
		config.features?.tooltip?.position,
	]);

	return { ref, view, value, valid };
}
