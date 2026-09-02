import type { Hono } from "hono";
import { z } from "zod";
import type { AuthRuntime } from "../auth/runtime";
import { badRequest, type QueryRow, unauthorized } from "../planner/shared";
import { socialUser } from "./shared";

const profileSchema = z
	.object({ name: z.string().trim().min(1).max(100), image: z.url().nullable().optional() })
	.strict();
const settingsSchema = z
	.object({ theme: z.enum(["system", "light", "dark"]), notificationsEnabled: z.boolean() })
	.strict();

export function installProfileRoutes(app: Hono, auth: AuthRuntime) {
	app.get("/api/profile", async (context) => {
		const userId = await socialUser(auth, context);
		if (!userId) return unauthorized(context);
		const [row] = await auth.planner.query<QueryRow>(
			`SELECT id, username, name, image FROM "user" WHERE id = $1`,
			[userId],
		);
		return context.json(row);
	});

	app.patch("/api/profile", async (context) => {
		const userId = await socialUser(auth, context);
		const input = profileSchema.safeParse(await context.req.json().catch(() => null));
		if (!userId) return unauthorized(context);
		if (!input.success) return badRequest(context);
		const [row] = await auth.planner.query<QueryRow>(
			`UPDATE "user" SET name = $2, image = $3, updated_at = now()
			 WHERE id = $1 RETURNING id, username, name, image`,
			[userId, input.data.name, input.data.image ?? null],
		);
		return context.json(row);
	});

	app.put("/api/settings", async (context) => {
		const userId = await socialUser(auth, context);
		const input = settingsSchema.safeParse(await context.req.json().catch(() => null));
		if (!userId) return unauthorized(context);
		if (!input.success) return badRequest(context);
		const [row] = await auth.planner.query<QueryRow>(
			`INSERT INTO user_settings (user_id, theme, notifications_enabled)
			 VALUES ($1, $2, $3)
			 ON CONFLICT (user_id) DO UPDATE
			 SET theme = EXCLUDED.theme, notifications_enabled = EXCLUDED.notifications_enabled, updated_at = now()
			 RETURNING theme, notifications_enabled AS "notificationsEnabled"`,
			[userId, input.data.theme, input.data.notificationsEnabled],
		);
		return context.json(row);
	});
}
