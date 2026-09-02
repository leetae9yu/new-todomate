import type { DB } from "@better-auth/drizzle-adapter";
import { PGlite } from "@electric-sql/pglite";
import { mkdir } from "node:fs/promises";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { AUTH_MIGRATION_SQL } from "../db/auth-migration";
import * as schema from "../db/schema";
import { accountStatusSchema, createAuthRuntime } from "./runtime";

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

	const database = drizzle(client, { schema });
	const runtime = createAuthRuntime({
		baseURL,
		secret,
		store: {
			adapterDatabase: database as unknown as DB,
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
