import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useSELEditor } from "./use-sel-editor";

import type { SELSchema } from "@seljs/schema";

const testSchema = {
	version: "1.0.0",
	contracts: [
		{
			name: "erc20",
			methods: [
				{
					name: "balanceOf",
					params: [{ name: "owner", type: "address" }],
					returns: "uint256",
				},
			],
		},
	],
	variables: [{ name: "user", type: "address" }],
	types: [],
	functions: [],
	macros: [],
} as unknown as SELSchema;

describe("src/use-sel-editor.ts", () => {
	it("creates an EditorView when ref is attached", () => {
		const { result } = renderHook(() => useSELEditor({ schema: testSchema }));

		const container = document.createElement("div");
		document.body.appendChild(container);

		act(() => {
			result.current.ref(container);
		});

		expect(result.current.view).not.toBeNull();

		document.body.removeChild(container);
	});

	it("cleans up EditorView on unmount", () => {
		const { result, unmount } = renderHook(() =>
			useSELEditor({ schema: testSchema }),
		);

		const container = document.createElement("div");
		document.body.appendChild(container);

		act(() => {
			result.current.ref(container);
		});

		const view = result.current.view;
		expect(view).not.toBeNull();

		unmount();

		// No errors should occur during cleanup
		document.body.removeChild(container);
	});

	it("updates value reactively on editor changes", () => {
		const { result } = renderHook(() => useSELEditor({ schema: testSchema }));

		const container = document.createElement("div");
		document.body.appendChild(container);

		act(() => {
			result.current.ref(container);
		});

		expect(result.current.value).toBe("");

		act(() => {
			result.current.view!.dispatch({
				changes: { from: 0, insert: "test expression" },
			});
		});

		expect(result.current.value).toBe("test expression");

		document.body.removeChild(container);
	});

	it("calls onChange when editor content changes", () => {
		const onChange = vi.fn();
		const { result } = renderHook(() =>
			useSELEditor({ schema: testSchema, onChange }),
		);

		const container = document.createElement("div");
		document.body.appendChild(container);

		act(() => {
			result.current.ref(container);
		});

		act(() => {
			result.current.view!.dispatch({
				changes: { from: 0, insert: "hello" },
			});
		});

		expect(onChange).toHaveBeenCalledWith("hello", expect.any(Boolean));

		document.body.removeChild(container);
	});

	it("sets initial value from config", () => {
		const { result } = renderHook(() =>
			useSELEditor({ schema: testSchema, value: "initial" }),
		);

		expect(result.current.value).toBe("initial");

		const container = document.createElement("div");
		document.body.appendChild(container);

		act(() => {
			result.current.ref(container);
		});

		expect(result.current.view!.state.doc.toString()).toBe("initial");

		document.body.removeChild(container);
	});

	it("cleans up previous view when ref is called with null", () => {
		const { result } = renderHook(() => useSELEditor({ schema: testSchema }));

		const container = document.createElement("div");
		document.body.appendChild(container);

		act(() => {
			result.current.ref(container);
		});
		expect(result.current.view).not.toBeNull();

		act(() => {
			result.current.ref(null);
		});
		expect(result.current.view).toBeNull();

		document.body.removeChild(container);
	});
});
