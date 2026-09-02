import type { Hono } from "hono";
import { z } from "zod";
import type { AuthRuntime } from "../auth/runtime";
import { badRequest, notFound, type QueryRow, unauthorized } from "../planner/shared";
import { membership, socialUser } from "./shared";

const groupSchema = z.object({ name: z.string().trim().min(1).max(100) }).strict();
const respondSchema = z.object({ accept: z.boolean() }).strict();
const roleSchema = z.object({ role: z.enum(["member", "admin"]) }).strict();

export function installGroupRoutes(app: Hono, auth: AuthRuntime) {
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

	app.post("/api/groups/:id/invites", async (context) => {
		const userId = await socialUser(auth, context);
		const groupId = z.uuid().safeParse(context.req.param("id"));
		if (!userId) return unauthorized(context);
		if (!groupId.success) return badRequest(context);
		const role = await membership(auth, groupId.data, userId);
		if (role !== "owner" && role !== "admin") {
			return context.json({ error: { code: "FORBIDDEN" } }, 403);
		}
		const token = crypto.randomUUID();
		await auth.planner.query(
			`INSERT INTO group_invite (id, group_id, created_by, token)
			 VALUES ($1, $2, $3, $4)`,
			[crypto.randomUUID(), groupId.data, userId, token],
		);
		return context.json({ token }, 201);
	});

	app.post("/api/invites/:token/respond", async (context) => {
		const userId = await socialUser(auth, context);
		const input = respondSchema.safeParse(await context.req.json().catch(() => null));
		if (!userId) return unauthorized(context);
		if (!input.success) return badRequest(context);
		const [invite] = await auth.planner.query<QueryRow>(
			"SELECT id, group_id AS \"groupId\" FROM group_invite WHERE token = $1 AND status = 'pending'",
			[context.req.param("token")],
		);
		if (!invite) return notFound(context);
		const status = input.data.accept ? "accepted" : "rejected";
		await auth.planner.query(
			`UPDATE group_invite SET status = $2, responded_by = $3, responded_at = $4
			 WHERE id = $1`,
			[String(invite.id), status, userId, new Date().toISOString()],
		);
		if (input.data.accept) {
			await auth.planner.query(
				`INSERT INTO group_membership (group_id, user_id, role)
				 VALUES ($1, $2, 'member') ON CONFLICT (group_id, user_id) DO NOTHING`,
				[String(invite.groupId), userId],
			);
		}
		return context.json({
			groupId: String(invite.groupId),
			role: input.data.accept ? "member" : null,
			status,
		});
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
}
