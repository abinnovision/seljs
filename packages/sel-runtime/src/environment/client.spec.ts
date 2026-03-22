import { describe, expect, it } from "vitest";

import { validateClient } from "./client.js";
import { SELClientError } from "../errors/index.js";

describe("src/environment/client.ts", () => {
	describe("validateClient", () => {
		it("does not throw for a valid minimal object", () => {
			const client = {
				call: () => Promise.resolve({}),
				getBlockNumber: () => Promise.resolve(0n),
			};

			expect(() => {
				validateClient(client);
			}).not.toThrow();
		});

		it("throws SELClientError when call is missing", () => {
			const client = {
				getBlockNumber: () => Promise.resolve(0n),
			};

			expect(() => {
				validateClient(client);
			}).toThrow(SELClientError);
		});

		it("throws SELClientError when getBlockNumber is missing", () => {
			const client = {
				call: () => Promise.resolve({}),
			};

			expect(() => {
				validateClient(client);
			}).toThrow(SELClientError);
		});

		it("throws SELClientError for null", () => {
			expect(() => {
				validateClient(null);
			}).toThrow(SELClientError);
		});

		it("throws SELClientError for undefined", () => {
			expect(() => {
				validateClient(undefined);
			}).toThrow(SELClientError);
		});

		it("throws SELClientError for a non-object (string)", () => {
			expect(() => {
				validateClient("not-an-object");
			}).toThrow(SELClientError);
		});

		it("throws SELClientError when call is not a function", () => {
			const client = {
				call: "not-a-function",
				getBlockNumber: () => Promise.resolve(0n),
			};

			expect(() => {
				validateClient(client);
			}).toThrow(SELClientError);
		});
	});
});
