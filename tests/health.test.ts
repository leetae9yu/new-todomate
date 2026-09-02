import { describe, expect, test } from "bun:test";
import { createApp } from "../src/server/app";

describe("health endpoint", () => {
	test("reports the API as ready", async () => {
		const response = await createApp().request("/api/health");

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({
			status: "ok",
			service: "new-todomate-api",
		});
	});
});
