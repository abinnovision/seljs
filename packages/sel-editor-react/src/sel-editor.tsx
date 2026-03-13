import { useSELEditor } from "./use-sel-editor";

import type { SELEditorConfig } from "@seljs/editor";

export interface SELEditorProps extends Omit<SELEditorConfig, "parent"> {
	className?: string;
}

export function SELEditor({ className, ...config }: SELEditorProps) {
	const { ref } = useSELEditor(config);

	return <div ref={ref} className={className} />;
}
