import { createApp } from "../../src/server/app";
import { createPgliteAuthRuntime } from "../../src/server/auth/pglite";

export const approvedCredentials = {
	username: "demo",
	password: "demo-pass",
} as const;

export const disabledCredentials = {
	username: "disabled",
	password: "disabled-pass",
} as const;

export async function createAuthTestApp() {
	const auth = await createPgliteAuthRuntime({
		baseURL: "https://todomate.test",
		secret: "test-secret-that-is-long-enough-for-better-auth",
	});

	await auth.seedAccount({
		...approvedCredentials,
		name: "데모",
		status: "active",
	});
	await auth.seedAccount({
		...disabledCredentials,
		name: "비활성 사용자",
		status: "disabled",
	});

	return {
		app: createApp({ auth }),
		close: auth.close,
	};
}
