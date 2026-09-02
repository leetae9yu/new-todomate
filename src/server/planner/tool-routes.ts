import type { Hono } from "hono";
import { z } from "zod";
import type { AuthRuntime } from "../auth/runtime";
import {
	badRequest,
	notFound,
	plannerOwner,
	timestamp,
	type QueryRow,
	unauthorized,
} from "./shared";
import { diarySchema, localDateSchema, parseBody } from "./validation";

export function installToolRoutes(app: Hono, auth: AuthRuntime) {
	app.get("/api/timer/active", async (context) => {
		const ownerId = await plannerOwner(auth, context);
		if (!ownerId) return unauthorized(context);
		const [task] = await auth.planner.query<QueryRow>(
			`SELECT id AS "taskId", title AS "taskTitle", timer_started_at AS "startedAt",
			 timer_elapsed_seconds AS "elapsedSeconds" FROM task
			 WHERE owner_id = $1 AND timer_started_at IS NOT NULL LIMIT 1`,
			[ownerId],
		);
		if (!task) {
			return context.json({
				status: "idle",
				taskId: null,
				taskTitle: null,
				startedAt: null,
				elapsedSeconds: 0,
			});
		}
		const startedAt = timestamp(task.startedAt);
		const elapsedSeconds =
			Number(task.elapsedSeconds) +
			Math.max(0, Math.floor((Date.now() - new Date(String(task.startedAt)).getTime()) / 1000));
		return context.json({
			status: "running",
			taskId: String(task.taskId),
			taskTitle: String(task.taskTitle),
			startedAt,
			elapsedSeconds,
		});
	});

	app.post("/api/tasks/:id/timer/start", async (context) => {
		const ownerId = await plannerOwner(auth, context);
		const id = z.uuid().safeParse(context.req.param("id"));
		if (!ownerId) return unauthorized(context);
		if (!id.success) return badRequest(context);
		const running = await auth.planner.query<QueryRow>(
			"SELECT id FROM task WHERE owner_id = $1 AND timer_started_at IS NOT NULL",
			[ownerId],
		);
		if (running[0]) return context.json({ error: { code: "TIMER_ALREADY_RUNNING" } }, 409);
		const startedAt = new Date().toISOString();
		const [row] = await auth.planner.query<QueryRow>(
			`UPDATE task SET timer_started_at = $3::timestamptz WHERE id = $1 AND owner_id = $2
			 RETURNING id AS "taskId", title AS "taskTitle", timer_started_at AS "startedAt"`,
			[id.data, ownerId, startedAt],
		);
		return row
			? context.json(
					{
						status: "running",
						taskId: row.taskId,
						taskTitle: row.taskTitle,
						startedAt: timestamp(row.startedAt),
						elapsedSeconds: 0,
					},
					201,
				)
			: notFound(context);
	});

	app.post("/api/tasks/:id/timer/stop", async (context) => {
		const ownerId = await plannerOwner(auth, context);
		const id = z.uuid().safeParse(context.req.param("id"));
		if (!ownerId) return unauthorized(context);
		if (!id.success) return badRequest(context);
		const [task] = await auth.planner.query<QueryRow>(
			"SELECT timer_started_at AS \"startedAt\", timer_elapsed_seconds AS \"elapsedSeconds\" FROM task WHERE id = $1 AND owner_id = $2",
			[id.data, ownerId],
		);
		if (!task) return notFound(context);
		if (task.startedAt === null) return context.json({ error: { code: "TIMER_NOT_RUNNING" } }, 409);
		const elapsedSeconds =
			Number(task.elapsedSeconds) +
			Math.max(0, Math.floor((Date.now() - new Date(String(task.startedAt)).getTime()) / 1000));
		await auth.planner.query(
			"UPDATE task SET timer_started_at = NULL, timer_elapsed_seconds = $3 WHERE id = $1 AND owner_id = $2",
			[id.data, ownerId, elapsedSeconds],
		);
		return context.json({ status: "stopped", taskId: id.data, elapsedSeconds });
	});

	app.put("/api/diary/:date", async (context) => {
		const ownerId = await plannerOwner(auth, context);
		const date = localDateSchema.safeParse(context.req.param("date"));
		const input = await parseBody(context, diarySchema);
		if (!ownerId) return unauthorized(context);
		if (!date.success || !input.success) return badRequest(context);
		const [row] = await auth.planner.query<QueryRow>(
			`INSERT INTO diary (id, owner_id, date, mood, body, updated_at) VALUES ($1, $2, $3, $4, $5, $6::timestamptz)
			 ON CONFLICT (owner_id, date) DO UPDATE SET mood = EXCLUDED.mood, body = EXCLUDED.body, updated_at = EXCLUDED.updated_at
			 RETURNING date, mood, body`,
			[crypto.randomUUID(), ownerId, date.data, input.data.mood, input.data.body, new Date().toISOString()],
		);
		return context.json(row);
	});

	app.get("/api/diary/:date", async (context) => {
		const ownerId = await plannerOwner(auth, context);
		const date = localDateSchema.safeParse(context.req.param("date"));
		if (!ownerId) return unauthorized(context);
		if (!date.success) return badRequest(context);
		const [row] = await auth.planner.query<QueryRow>(
			"SELECT date, mood, body FROM diary WHERE owner_id = $1 AND date = $2",
			[ownerId, date.data],
		);
		return row ? context.json(row) : notFound(context);
	});

	app.get("/api/stats", async (context) => {
		const ownerId = await plannerOwner(auth, context);
		const input = z.object({ from: localDateSchema, to: localDateSchema }).strict().safeParse(context.req.query());
		if (!ownerId) return unauthorized(context);
		if (!input.success || input.data.from > input.data.to) return badRequest(context);
		const rows = await auth.planner.query<QueryRow>(
			`SELECT category_id AS "categoryId", COUNT(*)::integer AS total,
			 COUNT(*) FILTER (WHERE completed)::integer AS completed,
			 COALESCE(COUNT(*) FILTER (WHERE completed)::float / NULLIF(COUNT(*), 0), 0) AS rate
			 FROM task WHERE owner_id = $1 AND date >= $2 AND date <= $3 GROUP BY category_id ORDER BY category_id`,
			[ownerId, input.data.from, input.data.to],
		);
		return context.json({
			categories: rows.map((row) => ({
				categoryId: row.categoryId,
				completed: Number(row.completed),
				total: Number(row.total),
				rate: Number(row.rate),
			})),
		});
	});
}
