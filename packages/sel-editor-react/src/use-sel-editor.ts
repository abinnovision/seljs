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
	const [view, setView] = useState<EditorView | null>(null);
	const [value, setValue] = useState(config.value ?? "");
	const [valid, setValid] = useState(true);
	const configRef = useRef(config);
	configRef.current = config;

	const ref = useCallback<RefCallback<HTMLElement>>(
		(node) => {
			if (viewRef.current) {
				viewRef.current.destroy();
				viewRef.current = null;
				setView(null);
			}

			if (!node) {
				return;
			}

			const currentConfig = configRef.current;
			const editor = createSELEditor({
				...currentConfig,
				parent: node,
				onChange: (newValue, isValid) => {
					setValue(newValue);
					setValid(isValid);
					currentConfig.onChange?.(newValue, isValid);
				},
			});
			viewRef.current = editor;
			setView(editor);
		},
		[config.schema],
	);

	useEffect(() => {
		return () => {
			viewRef.current?.destroy();
			viewRef.current = null;
		};
	}, []);

	return { ref, view, value, valid };
}
