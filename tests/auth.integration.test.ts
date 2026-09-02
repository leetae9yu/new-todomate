import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Hono } from "hono";
import { createPgliteAuthRuntime } from "../src/server/auth/pglite";
import {
	approvedCredentials,
	createAuthTestApp,
	disabledCredentials,
} from "./helpers/auth-test-app";

type TestApp = Awaited<ReturnType<typeof createAuthTestApp>>;

describe("approved credential authentication", () => {
	let harness: TestApp;
	let app: Hono;

	beforeAll(async () => {
		harness = await createAuthTestApp();
		app = harness.app;
	}, 20_000);

	afterAll(async () => {
		await harness.close();
	}, 20_000);

	test("approved account receives a secure session cookie", async () => {
		const response = await signIn(app, approvedCredentials);
		const cookie = response.headers.get("set-cookie");
		const body = await response.json();

		expect(response.status).toBe(200);
		expect(cookie).toContain("HttpOnly");
		expect(cookie).toContain("Secure");
		expect(cookie).toContain("SameSite=Lax");
		expect(body).not.toHaveProperty("token");
		expect(body).toMatchObject({
			user: {
				username: approvedCredentials.username,
				status: "active",
			},
		});
	});

	test.each([
		{
			name: "unknown username",
			credentials: { username: "intruder", password: "guess" },
		},
		{
			name: "wrong password",
			credentials: { username: approvedCredentials.username, password: "wrong-pass" },
		},
		{
			name: "disabled account",
			credentials: disabledCredentials,
		},
	])("rejects $name without issuing a session", async ({ credentials }) => {
		const response = await signIn(app, credentials);

		expect(response.status).toBe(401);
		expect(response.headers.get("set-cookie")).toBeNull();
		expect(await response.json()).toEqual({
			error: {
				code: "INVALID_CREDENTIALS",
				message: "아이디 또는 비밀번호를 확인해 주세요.",
			},
		});
	});
});

describe("local authentication storage", () => {
	test("creates missing parent directories on first start", async () => {
		const temporaryRoot = await mkdtemp(join(tmpdir(), "new-todomate-auth-"));
		const nestedDataDirectory = join(temporaryRoot, "nested", "auth");

		try {
			const auth = await createPgliteAuthRuntime({
				baseURL: "https://todomate.test",
				secret: "test-secret-that-is-long-enough-for-better-auth",
				dataDirectory: nestedDataDirectory,
			});

			await auth.close();
		} finally {
			await rm(temporaryRoot, { recursive: true, force: true });
		}
	}, 20_000);
});

function signIn(app: Hono, credentials: { username: string; password: string }) {
	return app.request("https://todomate.test/api/auth/sign-in", {
		method: "POST",
		headers: {
			"content-type": "application/json",
		},
		body: JSON.stringify(credentials),
	});
}
