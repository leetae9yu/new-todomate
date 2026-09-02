import { createNeonAuthRuntime } from "../../src/server/auth/neon";

const databaseURL = process.env.DATABASE_URL;
const secret = process.env.BETTER_AUTH_SECRET;
const username = process.env.ADMIN_USERNAME ?? "admin";
const password = process.env.ADMIN_PASSWORD ?? crypto.randomUUID();

if (!databaseURL || !secret) {
	throw new Error("DATABASE_URL and BETTER_AUTH_SECRET are required");
}

const auth = createNeonAuthRuntime({
	baseURL: process.env.APP_URL ?? "https://new-todomate.workers.dev",
	databaseURL,
	secret,
});

if (await auth.findByUsername(username)) {
	console.log(`approved account already exists: ${username}`);
} else {
	await auth.seedAccount({
		username,
		password,
		name: process.env.ADMIN_NAME ?? username,
		status: "active",
	});
	console.log(`approved account created: ${username}`);
	console.log(`temporary password: ${password}`);
}
