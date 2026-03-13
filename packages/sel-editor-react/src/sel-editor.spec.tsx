import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { SELEditor } from "./sel-editor";

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

describe("src/sel-editor.tsx", () => {
	it("renders without crashing", () => {
		const { container } = render(<SELEditor schema={testSchema} />);
		expect(container.firstChild).toBeTruthy();
	});

	it("applies className prop", () => {
		const { container } = render(
			<SELEditor schema={testSchema} className="my-editor" />,
		);
		expect(
			(container.firstChild as HTMLElement).classList.contains("my-editor"),
		).toBe(true);
	});

	it("renders with initial value", () => {
		const { container } = render(
			<SELEditor schema={testSchema} value="erc20.balanceOf(user)" />,
		);

		// CodeMirror creates its DOM inside the container div
		expect(container.querySelector(".cm-editor")).toBeTruthy();
	});

	it("accepts onChange callback", () => {
		const onChange = vi.fn();
		const { container } = render(
			<SELEditor schema={testSchema} onChange={onChange} />,
		);
		expect(container.querySelector(".cm-editor")).toBeTruthy();
	});

	it("accepts validate prop for error highlighting", () => {
		const validate = vi.fn().mockReturnValue([]);
		const { container } = render(
			<SELEditor schema={testSchema} value="test" validate={validate} />,
		);
		expect(container.querySelector(".cm-editor")).toBeTruthy();
	});

	it("renders with empty schema", () => {
		const emptySchema: SELSchema = {
			version: "1.0.0",
			contracts: [],
			variables: [],
			types: [],
			functions: [],
			macros: [],
		};
		const { container } = render(<SELEditor schema={emptySchema} />);
		expect(container.querySelector(".cm-editor")).toBeTruthy();
	});
});
