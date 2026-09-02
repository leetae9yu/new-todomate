import type { DB } from "@better-auth/drizzle-adapter";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { betterAuth } from "better-auth";
import { username } from "better-auth/plugins";
import { z } from "zod";
import { authSchema } from "../db/schema";

export const accountStatusSchema = z.enum(["active", "disabled"]);
export type AccountStatus = z.infer<typeof accountStatusSchema>;

type AccountStatusRecord = {
	id: string;
	status: AccountStatus;
};

export type AuthAccountStore = {
	adapterDatabase: DB;
	findByUsername: (username: string) => Promise<AccountStatusRecord | null>;
	setStatus: (username: string, status: AccountStatus) => Promise<void>;
};

type CreateAuthRuntimeOptions = {
	baseURL: string;
	secret: string;
	store: AuthAccountStore;
};

type SeedAccountInput = {
	username: string;
	password: string;
	name: string;
	status: AccountStatus;
};

export function createAuthRuntime({ baseURL, secret, store }: CreateAuthRuntimeOptions) {
	const auth = betterAuth({
		appName: "new todomate",
		baseURL,
		basePath: "/api/auth",
		secret,
		database: drizzleAdapter(store.adapterDatabase, {
			provider: "pg",
			schema: authSchema,
			transaction: false,
		}),
		emailAndPassword: {
			enabled: true,
			minPasswordLength: 8,
			autoSignIn: false,
		},
		user: {
			additionalFields: {
				status: {
					type: "string",
					required: true,
					defaultValue: "active",
					input: false,
				},
			},
		},
		plugins: [
			username({
				minUsernameLength: 3,
				maxUsernameLength: 30,
				immutableUsername: true,
			}),
		],
		advanced: {
			useSecureCookies: true,
			cookiePrefix: "new-todomate",
		},
		disabledPaths: ["/is-username-available"],
		telemetry: {
			enabled: false,
		},
	});

	return {
		handler: (request: Request) => auth.handler(request),
		getSession: (headers: Headers) => auth.api.getSession({ headers }),
		findByUsername: store.findByUsername,
		seedAccount: async ({ username: accountUsername, password, name, status }: SeedAccountInput) => {
			await auth.api.signUpEmail({
				body: {
					email: `${accountUsername}@new-todomate.test`,
					password,
					name,
					username: accountUsername,
					displayUsername: name,
				},
			});

			await store.setStatus(accountUsername, status);
		},
	};
}

export type AuthRuntime = ReturnType<typeof createAuthRuntime>;
