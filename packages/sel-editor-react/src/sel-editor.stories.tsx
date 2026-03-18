import { rules } from "@seljs/checker";
import { buildSchema } from "@seljs/env";
import { parseAbi } from "viem";

import { SELEditor } from "./sel-editor";

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

const meta: Meta<typeof SELEditor> = {
	title: "SELEditor",
	component: SELEditor,
	parameters: {
		layout: "padded",
	},
	decorators: [
		(Story) => (
			<div style={{ maxWidth: 700, margin: "0 auto" }}>
				<Story />
			</div>
		),
	],
	args: {
		schema: erc20Schema,
	},
};

type Story = StoryObj<typeof SELEditor>;

const Default: Story = {};

const WithExpression: Story = {
	args: {
		value: "erc20.balanceOf(user) > 1000",
	},
};

const ComplexExpression: Story = {
	args: {
		value:
			'erc20.balanceOf(user) > 0 && erc20.allowance(user, vault.getUserDeposit(user)) >= int(1000) ? "eligible" : "not eligible"',
	},
};

const WithValidation: Story = {
	name: "Built-in Validation",
	args: {
		value: "erc20.unknownMethod(user)",
	},
};

const WithLintRules: Story = {
	name: "Lint Rules (Redundant Bool)",
	args: {
		value: "erc20.balanceOf(user) > 0 == true",
		checkerOptions: { rules: rules.builtIn },
	},
};

const WithLintSelfComparison: Story = {
	name: "Lint Rules (Self Comparison)",
	args: {
		value: "erc20.totalSupply() == erc20.totalSupply()",
		checkerOptions: { rules: rules.builtIn },
	},
};

const WithLintConstantCondition: Story = {
	name: "Lint Rules (Constant Condition)",
	args: {
		value: "true && erc20.balanceOf(user) > 0",
		checkerOptions: { rules: rules.builtIn },
	},
};

const RequireTypeBoolPass: Story = {
	name: "Require Type Bool (Pass)",
	args: {
		value: "erc20.balanceOf(user) > 0",
		checkerOptions: { rules: [rules.requireType("bool"), ...rules.builtIn] },
	},
};

const RequireTypeBoolFail: Story = {
	name: "Require Type Bool (Fail)",
	args: {
		value: "erc20.balanceOf(user)",
		checkerOptions: { rules: [rules.requireType("bool"), ...rules.builtIn] },
	},
};

const ReadOnly: Story = {
	args: {
		value: "erc20.balanceOf(user) > 0",
		readOnly: true,
	},
};

const WithPlaceholder: Story = {
	args: {
		placeholder: "Enter a CEL expression, e.g. erc20.balanceOf(user) > 0",
	},
};

const DarkMode: Story = {
	args: {
		value: "erc20.balanceOf(user) > 1000",
		dark: true,
	},
	decorators: [
		(Story) => (
			<div
				style={{
					background: "#1e1e1e",
					padding: 24,
					borderRadius: 8,
				}}
			>
				<Story />
			</div>
		),
	],
};

const EmptySchema: Story = {
	args: {
		schema: emptySchema,
		value: "some_expression > 0",
	},
};

const LiveEditing: Story = {
	name: "Live Editing (try autocomplete)",
	args: {
		placeholder: "Start typing... try 'erc' or 'user' and press Ctrl+Space",
	},
};

const WithTypeDisplay: Story = {
	name: "Type Display",
	args: {
		value: "erc20.balanceOf(user) > 0",
		features: { typeDisplay: true },
	},
};

const TypeDisplayDark: Story = {
	name: "Type Display (Dark)",
	args: {
		value: "erc20.balanceOf(user)",
		features: { typeDisplay: true },
		dark: true,
	},
	decorators: [
		(Story) => (
			<div
				style={{
					background: "#1e1e1e",
					padding: 24,
					borderRadius: 8,
				}}
			>
				<Story />
			</div>
		),
	],
};

export default meta;
export {
	Default,
	WithExpression,
	ComplexExpression,
	WithValidation,
	WithLintRules,
	WithLintSelfComparison,
	WithLintConstantCondition,
	RequireTypeBoolPass,
	RequireTypeBoolFail,
	ReadOnly,
	WithPlaceholder,
	DarkMode,
	EmptySchema,
	LiveEditing,
	WithTypeDisplay,
	TypeDisplayDark,
};
