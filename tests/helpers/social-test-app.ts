import { createApp } from "../../src/server/app";
import { createPgliteAuthRuntime } from "../../src/server/auth/pglite";

export const friendCredentials = {
	username: "friend",
	password: "friend-pass",
} as const;

type JsonRequestInit = {
	method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
	body?: unknown;
};

export async function createSocialTestApp() {
	const auth = await createPgliteAuthRuntime({
		baseURL: "https://todomate.test",
		secret: "test-secret-that-is-long-enough-for-better-auth",
	});
	await auth.seedAccount({
		username: "demo",
		password: "demo-pass",
		name: "데모",
		status: "active",
	});
	await auth.seedAccount({ ...friendCredentials, name: "친구", status: "active" });
	const app = createApp({ auth });

	async function as(username: string, password: string) {
		const signIn = await app.request("https://todomate.test/api/auth/sign-in", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ username, password }),
		});
		const cookie = signIn.headers.get("set-cookie")?.split(";")[0];
		if (!cookie) throw new Error(`No session cookie for ${username}`);
		return (path: string, init: JsonRequestInit = {}) =>
			app.request(`https://todomate.test${path}`, {
				method: init.method ?? "GET",
				headers: {
					cookie,
					...(init.body === undefined ? {} : { "content-type": "application/json" }),
				},
				...(init.body === undefined ? {} : { body: JSON.stringify(init.body) }),
			});
	}

	return {
		demo: await as("demo", "demo-pass"),
		friend: await as(friendCredentials.username, friendCredentials.password),
		close: auth.close,
	};
}
