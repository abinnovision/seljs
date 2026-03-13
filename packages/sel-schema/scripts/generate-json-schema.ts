import { writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createGenerator } from "ts-json-schema-generator";

const __dirname = dirname(fileURLToPath(import.meta.url));
const outputPath = resolve(__dirname, "../dist/sel-schema.json");

const generator = createGenerator({
	path: resolve(__dirname, "../src/types.ts"),
	tsconfig: resolve(__dirname, "../tsconfig.build.json"),
	type: "SELSchema",
});

const schema = generator.createSchema("SELSchema");

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, JSON.stringify(schema, null, "\t"));

// eslint-disable-next-line no-console
console.log("Generated JSON Schema at", outputPath);
