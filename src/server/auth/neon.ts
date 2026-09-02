import type { DB } from "@better-auth/drizzle-adapter";
import { neon } from "@neondatabase/serverless";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "../db/schema";
import { accountStatusSchema, createAuthRuntime } from "./runtime";

type CreateNeonRuntimeOptions = {
	baseURL: string;
	databaseURL: string;
	secret: string;
};

export function createNeonAuthRuntime({
	baseURL,
	databaseURL,
	secret,
}: CreateNeonRuntimeOptions) {
	const client = neon(databaseURL);
	const database = drizzle({ client, schema });

	return createAuthRuntime({
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
}
