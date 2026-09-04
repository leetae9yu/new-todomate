import type { DB } from "@better-auth/drizzle-adapter";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { betterAuth } from "better-auth";
import { username } from "better-auth/plugins";
import { z } from "zod";
import { authSchema } from "../db/schema";

export const accountStatusSchema = z.enum(["active", "disabled", "provisioning"]);
export type AccountStatus = z.infer<typeof accountStatusSchema>;

type AccountStatusRecord = {
	id: string;
	status: AccountStatus;
};

export type PlannerQueryParameter = boolean | null | number | string;

export type PlannerStore = {
	query: <T extends Record<string, unknown>>(
		statement: string,
		parameters?: PlannerQueryParameter[],
	) => Promise<T[]>;
};

export type AuthAccountStore = {
	adapterDatabase: DB;
	planner: PlannerStore;
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
					defaultValue: "provisioning",
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

	const createAccount = async ({
		username: accountUsername,
		password,
		name,
		status,
	}: SeedAccountInput) => {
		const result = await auth.api.signUpEmail({
			body: {
				email: `${accountUsername}@new-todomate.test`,
				password,
				name,
				username: accountUsername,
				displayUsername: name,
			},
		});
		await store.setStatus(accountUsername, status);
		return { id: result.user.id, username: accountUsername, name, status };
	};

	return {
		handler: (request: Request) => auth.handler(request),
		getSession: async (headers: Headers) => {
			const session = await auth.api.getSession({ headers });
			if (!session?.user.username) return null;
			const account = await store.findByUsername(session.user.username);
			return account?.status === "active" ? session : null;
		},
		planner: store.planner,
		findByUsername: store.findByUsername,
		createAccount,
		seedAccount: async (input: SeedAccountInput) => {
			await createAccount(input);
		},
	};
}

export type AuthRuntime = ReturnType<typeof createAuthRuntime>;
