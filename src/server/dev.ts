import { createApp } from "./app";
import { createPgliteAuthRuntime } from "./auth/pglite";

const port = Number(process.env.PORT ?? "8787");
const baseURL = process.env.BETTER_AUTH_URL ?? "http://localhost:5173";
const secret =
	process.env.BETTER_AUTH_SECRET ?? "local-development-secret-change-before-production";

const auth = await createPgliteAuthRuntime({
	baseURL,
	secret,
	dataDirectory: ".data/local-auth",
});

const existingDemo = await auth.findByUsername("demo");
if (!existingDemo) {
	await auth.seedAccount({
		username: "demo",
		password: "demo-pass",
		name: "데모",
		status: "active",
	});
}

if (process.env.SEED_QA === "1" && !(await auth.findByUsername("friend"))) {
	await auth.seedAccount({
		username: "friend",
		password: "friend-pass",
		name: "친구",
		status: "active",
	});
}

const app = createApp({ auth });
const server = Bun.serve({
	fetch: app.fetch,
	hostname: "127.0.0.1",
	port,
});

console.log(`new-todomate API listening on ${server.url}`);
