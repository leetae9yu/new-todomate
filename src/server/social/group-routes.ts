import type { Hono } from "hono";
import { z } from "zod";
import type { AuthRuntime } from "../auth/runtime";
import type { ChatGateway } from "../chat";
import { badRequest, notFound, type QueryRow, unauthorized } from "../planner/shared";
import { membership, socialUser } from "./shared";

const groupSchema = z.object({ name: z.string().trim().min(1).max(100) }).strict();
const roleSchema = z.object({ role: z.enum(["member", "admin"]) }).strict();

export function installGroupRoutes(app: Hono, auth: AuthRuntime, chatGateway?: ChatGateway) {
	app.get("/api/groups", async (context) => {
		const userId = await socialUser(auth, context);
		if (!userId) return unauthorized(context);
		const rows = await auth.planner.query<QueryRow>(
			`SELECT g.id, g.name, m.role
			 FROM group_membership m JOIN social_group g ON g.id = m.group_id
			 WHERE m.user_id = $1 ORDER BY g.created_at`,
			[userId],
		);
		return context.json({ groups: rows });
	});

	app.post("/api/groups", async (context) => {
		const userId = await socialUser(auth, context);
		const input = groupSchema.safeParse(await context.req.json().catch(() => null));
		if (!userId) return unauthorized(context);
		if (!input.success) return badRequest(context);
		const groupId = crypto.randomUUID();
		await auth.planner.query(
			"INSERT INTO social_group (id, name, owner_id) VALUES ($1, $2, $3)",
			[groupId, input.data.name, userId],
		);
		await auth.planner.query(
			"INSERT INTO group_membership (group_id, user_id, role) VALUES ($1, $2, 'owner')",
			[groupId, userId],
		);
		return context.json({ id: groupId, name: input.data.name, role: "owner" }, 201);
	});

	app.get("/api/groups/:id/members", async (context) => {
		const userId = await socialUser(auth, context);
		const groupId = z.uuid().safeParse(context.req.param("id"));
		if (!userId) return unauthorized(context);
		if (!groupId.success) return badRequest(context);
		if (!(await membership(auth, groupId.data, userId))) {
			return context.json({ error: { code: "FORBIDDEN" } }, 403);
		}
		const rows = await auth.planner.query<QueryRow>(
			`SELECT u.id, u.username, u.name, u.image, m.role
			 FROM group_membership m JOIN "user" u ON u.id = m.user_id
			 WHERE m.group_id = $1 ORDER BY m.created_at`,
			[groupId.data],
		);
		return context.json(rows);
	});

	app.patch("/api/groups/:id/members/:userId", async (context) => {
		const actorId = await socialUser(auth, context);
		const groupId = z.uuid().safeParse(context.req.param("id"));
		const memberId = z.string().min(1).safeParse(context.req.param("userId"));
		const input = roleSchema.safeParse(await context.req.json().catch(() => null));
		if (!actorId) return unauthorized(context);
		if (!groupId.success || !memberId.success || !input.success) return badRequest(context);
		if ((await membership(auth, groupId.data, actorId)) !== "owner") {
			return context.json({ error: { code: "FORBIDDEN" } }, 403);
		}
		const [row] = await auth.planner.query<QueryRow>(
			`UPDATE group_membership SET role = $3
			 WHERE group_id = $1 AND user_id = $2 RETURNING user_id AS id, role`,
			[groupId.data, memberId.data, input.data.role],
		);
		return row ? context.json(row) : notFound(context);
	});

	app.delete("/api/groups/:id/members/:userId", async (context) => {
		const actorId = await socialUser(auth, context);
		const groupId = z.uuid().safeParse(context.req.param("id"));
		const memberId = z.string().min(1).safeParse(context.req.param("userId"));
		if (!actorId) return unauthorized(context);
		if (!groupId.success || !memberId.success) return badRequest(context);
		if ((await membership(auth, groupId.data, actorId)) !== "owner") {
			return context.json({ error: { code: "FORBIDDEN" } }, 403);
		}
		if (memberId.data === actorId) return context.json({ error: { code: "FORBIDDEN" } }, 403);
		const [removed] = await auth.planner.query<QueryRow>(
			"DELETE FROM group_membership WHERE group_id = $1 AND user_id = $2 RETURNING user_id",
			[groupId.data, memberId.data],
		);
		if (!removed) return notFound(context);
		if (chatGateway) {
			try {
				await chatGateway.revoke(`group:${groupId.data}`, memberId.data);
			} catch (error) {
				console.error("Failed to revoke removed group member's chat connection", error);
			}
		}
		return context.body(null, 204);
	});
}
