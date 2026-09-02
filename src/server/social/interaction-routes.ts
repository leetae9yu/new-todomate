import type { Hono } from "hono";
import { z } from "zod";
import type { AuthRuntime } from "../auth/runtime";
import { badRequest, notFound, type QueryRow, unauthorized } from "../planner/shared";
import { jsonMetadata, membership, socialUser } from "./shared";

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const reactionSchema = z.object({ emoji: z.string().trim().min(1).max(32) }).strict();

export function installInteractionRoutes(app: Hono, auth: AuthRuntime) {
	app.get("/api/groups/:id/feed", async (context) => {
		const userId = await socialUser(auth, context);
		const groupId = z.uuid().safeParse(context.req.param("id"));
		const date = dateSchema.safeParse(context.req.query("date"));
		if (!userId) return unauthorized(context);
		if (!groupId.success || !date.success) return badRequest(context);
		if (!(await membership(auth, groupId.data, userId))) {
			return context.json({ error: { code: "FORBIDDEN" } }, 403);
		}
		const tasks = await auth.planner.query<QueryRow>(
			`SELECT t.id, t.title, t.completed, t.completed_at AS "completedAt",
			        t.owner_id AS "ownerId", c.name AS "categoryName", c.color
			 FROM task t JOIN category c ON c.id = t.category_id
			 WHERE c.group_id = $1 AND c.visibility = 'group' AND t.date = $2
			 ORDER BY t.created_at`,
			[groupId.data, date.data],
		);
		const result = [];
		for (const task of tasks) {
			const reactions = await auth.planner.query<QueryRow>(
				`SELECT emoji, COUNT(*)::int AS count FROM task_reaction
				 WHERE task_id = $1 GROUP BY emoji ORDER BY emoji`,
				[String(task.id)],
			);
			result.push({ ...task, reactions: reactions.map((row) => ({ emoji: row.emoji, count: Number(row.count) })) });
		}
		return context.json({ tasks: result });
	});

	app.post("/api/tasks/:id/reactions", async (context) => {
		const userId = await socialUser(auth, context);
		const taskId = z.uuid().safeParse(context.req.param("id"));
		const input = reactionSchema.safeParse(await context.req.json().catch(() => null));
		if (!userId) return unauthorized(context);
		if (!taskId.success || !input.success) return badRequest(context);
		const [task] = await auth.planner.query<QueryRow>(
			`SELECT t.owner_id AS "ownerId", t.completed, c.group_id AS "groupId"
			 FROM task t JOIN category c ON c.id = t.category_id
			 WHERE t.id = $1 AND c.visibility = 'group'`,
			[taskId.data],
		);
		if (!task?.groupId || !(await membership(auth, String(task.groupId), userId))) return notFound(context);
		if (!task.completed) return context.json({ error: { code: "TASK_INCOMPLETE" } }, 409);
		const existing = await auth.planner.query<QueryRow>(
			"SELECT 1 FROM task_reaction WHERE task_id = $1 AND sender_id = $2",
			[taskId.data, userId],
		);
		await auth.planner.query(
			`INSERT INTO task_reaction (task_id, sender_id, emoji)
			 VALUES ($1, $2, $3)
			 ON CONFLICT (task_id, sender_id)
			 DO UPDATE SET emoji = EXCLUDED.emoji, updated_at = now()`,
			[taskId.data, userId, input.data.emoji],
		);
		if (String(task.ownerId) !== userId) {
			await auth.planner.query(
				`INSERT INTO notification (id, recipient_id, sender_id, type, metadata)
				 VALUES ($1, $2, $3, 'reaction', $4::jsonb)`,
				[
					crypto.randomUUID(),
					String(task.ownerId),
					userId,
					JSON.stringify({ deepLink: { taskId: taskId.data, groupId: String(task.groupId) } }),
				],
			);
		}
		return context.json({ emoji: input.data.emoji }, existing[0] ? 200 : 201);
	});

	app.delete("/api/tasks/:id/reactions", async (context) => {
		const userId = await socialUser(auth, context);
		const taskId = z.uuid().safeParse(context.req.param("id"));
		if (!userId) return unauthorized(context);
		if (!taskId.success) return badRequest(context);
		await auth.planner.query(
			"DELETE FROM task_reaction WHERE task_id = $1 AND sender_id = $2",
			[taskId.data, userId],
		);
		return context.json({ removed: true });
	});

	app.get("/api/notifications", async (context) => {
		const userId = await socialUser(auth, context);
		if (!userId) return unauthorized(context);
		const rows = await auth.planner.query<QueryRow>(
			`SELECT id, type, metadata, read_at AS "readAt", created_at AS "createdAt"
			 FROM notification WHERE recipient_id = $1 ORDER BY created_at DESC`,
			[userId],
		);
		return context.json({
			notifications: rows.map((row) => ({ ...row, ...((jsonMetadata(row.metadata) as object) ?? {}) })),
		});
	});

	app.patch("/api/notifications/:id/read", async (context) => {
		const userId = await socialUser(auth, context);
		if (!userId) return unauthorized(context);
		const [row] = await auth.planner.query<QueryRow>(
			`UPDATE notification SET read_at = now()
			 WHERE id = $1 AND recipient_id = $2 RETURNING id, read_at AS "readAt"`,
			[context.req.param("id"), userId],
		);
		return row ? context.json(row) : notFound(context);
	});
}
