import { rules } from "@seljs/checker";
import { buildSchema } from "@seljs/env";
import { parseAbi } from "viem";

import { SELEditor } from "./sel-editor";

import type { SELEditorProps } from "./sel-editor";
import type { SELSchema } from "@seljs/schema";
import type { Meta, StoryObj } from "@storybook/react";

const ERC20_ABI = parseAbi([
	"function balanceOf(address owner) view returns (uint256)",
	"function totalSupply() view returns (uint256)",
	"function allowance(address owner, address spender) view returns (uint256)",
	"function decimals() view returns (uint8)",
	"function name() view returns (string)",
	"function symbol() view returns (string)",
]);

const VAULT_ABI = parseAbi([
	"function getSharePrice() view returns (uint256)",
	"function getUserDeposit(address account) view returns (uint256)",
]);

const erc20Schema: SELSchema = buildSchema({
	contracts: {
		erc20: {
			address: "0x6B175474E89094C44Da98b954EedeAC495271d0F",
			abi: ERC20_ABI,
			description: "ERC-20 Token Standard",
		},
		vault: {
			address: "0x0000000000000000000000000000000000000001",
			abi: VAULT_ABI,
			description: "DeFi Vault contract",
		},
	},
	context: {
		user: { type: "sol_address", description: "The current user address" },
		blockNumber: { type: "sol_int", description: "Current block number" },
		timestamp: { type: "sol_int", description: "Current block timestamp" },
		chainId: { type: "sol_int", description: "Chain identifier" },
	},
});

const emptySchema: SELSchema = {
	version: "1.0.0",
	contracts: [],
	variables: [],
	types: [],
	functions: [],
	macros: [],
};

interface PlaygroundArgs extends SELEditorProps {
	linting: boolean;
	autocomplete: boolean;
	semanticHighlighting: boolean;
	typeDisplay: boolean;
	minLines: number;
}

function renderPlayground({
	linting,
	autocomplete,
	semanticHighlighting,
	typeDisplay,
	minLines,
	...props
}: PlaygroundArgs) {
	return (
		<SELEditor
			{...props}
			features={{
				linting,
				autocomplete,
				semanticHighlighting,
				typeDisplay,
				view: { minLines },
			}}
		/>
	);
}

const meta: Meta<PlaygroundArgs> = {
	title: "SELEditor",
	parameters: {
		layout: "padded",
	},
	decorators: [
		(Story, context) => (
			<div
				style={{
					maxWidth: 700,
					margin: "0 auto",
					...(context.args.dark
						? { background: "#1e1e1e", padding: 24, borderRadius: 8 }
						: {}),
				}}
			>
				<Story />
			</div>
		),
	],
	args: {
		schema: erc20Schema,
		value: "erc20.balanceOf(user) > 0",
		dark: false,
		readOnly: false,
		placeholder: "",
		linting: true,
		autocomplete: true,
		semanticHighlighting: true,
		typeDisplay: false,
		minLines: 1,
	},
	argTypes: {
		value: { control: "text" },
		dark: { control: "boolean" },
		readOnly: { control: "boolean" },
		placeholder: { control: "text" },
		linting: { control: "boolean" },
		autocomplete: { control: "boolean" },
		semanticHighlighting: { control: "boolean" },
		typeDisplay: { control: "boolean" },
		minLines: { control: { type: "number", min: 1, max: 20 } },
		schema: { control: false },
		onChange: { control: false },
		checkerOptions: { control: false },
		className: { control: false },
	},
	render: renderPlayground,
};

type Story = StoryObj<PlaygroundArgs>;

const Playground: Story = {
	name: "Playground",
};

const ComplexExpression: Story = {
	name: "Complex Expression",
	args: {
		value:
			'erc20.balanceOf(user) > 0 && erc20.allowance(user, vault.getUserDeposit(user)) >= int(1000) ? "eligible" : "not eligible"',
	},
};

const Validation: Story = {
	name: "Built-in Validation",
	args: {
		value: "erc20.unknownMethod(user)",
	},
};

const LintRules: Story = {
	name: "Lint Rules",
	args: {
		value: "erc20.balanceOf(user) > 0 == true",
		checkerOptions: { rules: rules.builtIn },
	},
};

const RequireTypeBool: Story = {
	name: "Require Type Bool",
	args: {
		value: "erc20.balanceOf(user)",
		checkerOptions: { rules: [rules.requireType("bool"), ...rules.builtIn] },
	},
};

const EmptySchema: Story = {
	name: "Empty Schema",
	args: {
		schema: emptySchema,
		value: "some_expression > 0",
	},
};

export default meta;
export {
	Playground,
	ComplexExpression,
	Validation,
	LintRules,
	RequireTypeBool,
	EmptySchema,
};
