# sel-env

Schema builder. Turns ABIs, context definitions, and Zod schemas into a SEL schema. Handles ABI parsing, struct field resolution, context extraction, and provides CEL built-in definitions.

The built-ins include the `block` constant (`block.number`, `block.timestamp`), which is omitted when the schema defines a contract or context variable named `block`, and `solInt(bytes)` for big-endian unsigned integers of at most 32 bytes.
