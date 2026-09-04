import { mkdir } from "node:fs/promises";
import type { DB } from "@better-auth/drizzle-adapter";
import { PGlite } from "@electric-sql/pglite";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { AUTH_MIGRATION_SQL } from "../db/auth-migration";
import { CHAT_MIGRATION_SQL } from "../db/chat-migration";
import { INVITATION_MIGRATION_SQL } from "../db/invitation-migration";
import { PLANNER_MIGRATION_SQL } from "../db/planner-migration";
import * as schema from "../db/schema";
import { SOCIAL_MIGRATION_SQL } from "../db/social-migration";
import { accountStatusSchema, createAuthRuntime, type PlannerQueryParameter } from "./runtime";

type CreatePgliteRuntimeOptions = {
	baseURL: string;
	secret: string;
	dataDirectory?: string;
};

export async function createPgliteAuthRuntime({
	baseURL,
	secret,
	dataDirectory,
}: CreatePgliteRuntimeOptions) {
	if (dataDirectory) {
		await mkdir(dataDirectory, { recursive: true });
	}

	const client = dataDirectory ? new PGlite(dataDirectory) : new PGlite();
	await client.exec(AUTH_MIGRATION_SQL);
	await client.exec(PLANNER_MIGRATION_SQL);
	await client.exec(SOCIAL_MIGRATION_SQL);
	await client.exec(CHAT_MIGRATION_SQL);
	await client.exec(INVITATION_MIGRATION_SQL);

	const database = drizzle(client, { schema });
	const runtime = createAuthRuntime({
		baseURL,
		secret,
		store: {
			adapterDatabase: database as unknown as DB,
			planner: {
				query: async <T extends Record<string, unknown>>(
					statement: string,
					parameters: PlannerQueryParameter[] = [],
				) => (await client.query<T>(statement, parameters)).rows,
			},
			findByUsername: async (accountUsername) => {
				const [record] = await database
					.select({
						id: schema.user.id,
						status: schema.user.status,
					})
					.from(schema.user)
					.where(eq(schema.user.username, accountUsername.toLowerCase()))
					.limit(1);

				if (!record) {
					return null;
				}

				const parsedStatus = accountStatusSchema.safeParse(record.status);
				return parsedStatus.success
					? {
						id: record.id,
						status: parsedStatus.data,
					}
					: null;
			},
			setStatus: async (accountUsername, status) => {
				await database
					.update(schema.user)
					.set({ status })
					.where(eq(schema.user.username, accountUsername.toLowerCase()));
			},
		},
	});

	return {
		...runtime,
		close: () => client.close(),
	};
}
