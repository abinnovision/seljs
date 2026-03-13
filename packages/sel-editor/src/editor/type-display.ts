import { type Extension, StateEffect, StateField } from "@codemirror/state";
import { EditorView, showPanel, type Panel } from "@codemirror/view";

import type { SELChecker } from "@seljs/checker";

const setType = StateEffect.define<string | null>();

const typeField = StateField.define<string | null>({
	create: () => null,
	update(value, tr) {
		for (const e of tr.effects) {
			if (e.is(setType)) {
				return e.value;
			}
		}

		return value;
	},
});

function createTypePanel(dark: boolean): (view: EditorView) => Panel {
	return (view: EditorView) => {
		const dom = document.createElement("div");
		dom.className = "sel-type-display";
		dom.style.cssText = [
			"display: flex",
			"align-items: center",
			"gap: 6px",
			`padding: 3px 8px`,
			"font-size: 12px",
			`font-family: 'JetBrains Mono', 'Fira Code', 'Consolas', monospace`,
			`color: ${dark ? "#9ca3af" : "#6b7280"}`,
			`background: ${dark ? "#262626" : "#f9fafb"}`,
			`border-top: 1px solid ${dark ? "#374151" : "#e5e7eb"}`,
		].join("; ");

		const update = () => {
			const type = view.state.field(typeField);
			dom.textContent = "";
			if (type) {
				const label = document.createElement("span");
				label.style.color = dark ? "#6b7280" : "#9ca3af";
				label.textContent = "output";

				const typeSpan = document.createElement("span");
				typeSpan.style.color = dark ? "#93c5fd" : "#2563eb";
				typeSpan.style.fontWeight = "500";
				typeSpan.textContent = type;

				dom.append(label, " ", typeSpan);
			}
		};

		update();

		return {
			dom,
			update: () => {
				update();
			},
		};
	};
}

export function createTypeDisplay(
	checker: SELChecker,
	dark: boolean,
): Extension {
	let debounceTimer: ReturnType<typeof setTimeout> | undefined;

	const plugin = EditorView.updateListener.of((update) => {
		if (!update.docChanged && !update.startState.field(typeField, false)) {
			return;
		}

		if (debounceTimer) {
			clearTimeout(debounceTimer);
		}

		debounceTimer = setTimeout(() => {
			const doc = update.state.doc.toString().trim();
			if (!doc) {
				update.view.dispatch({ effects: setType.of(null) });

				return;
			}

			const result = checker.check(doc);
			update.view.dispatch({
				effects: setType.of(result.valid ? (result.type ?? null) : null),
			});
		}, 200);
	});

	return [typeField, plugin, showPanel.of(createTypePanel(dark))];
}
