import type { Hono } from "hono";
import { z } from "zod";
import type { AuthRuntime } from "../auth/runtime";
import {
	badRequest,
	nextTaskPosition,
	notFound,
	plannerOwner,
	taskResponse,
	type QueryRow,
	unauthorized,
} from "./shared";
import { categorySchema, completionSchema, parseBody, taskPatchSchema, taskSchema } from "./validation";

export function installTaskRoutes(app: Hono, auth: AuthRuntime) {
	app.post("/api/categories", async (context) => {
		const ownerId = await plannerOwner(auth, context);
		const input = await parseBody(context, categorySchema);
		if (!ownerId) return unauthorized(context);
		if (!input.success) return badRequest(context);
		if (input.data.groupId) {
			const membership = await auth.planner.query<QueryRow>(
				"SELECT 1 FROM group_membership WHERE group_id = $1 AND user_id = $2",
				[input.data.groupId, ownerId],
			);
			if (!membership[0]) return notFound(context);
		}
		const [row] = await auth.planner.query<QueryRow>(
			`INSERT INTO category (id, owner_id, name, color, visibility, position, group_id)
			 VALUES ($1, $2, $3, $4, $5, (SELECT COALESCE(MAX(position), -1) + 1 FROM category WHERE owner_id = $2), $6)
			 RETURNING id, name, color, visibility, position`,
			[
				crypto.randomUUID(),
				ownerId,
				input.data.name,
				input.data.color,
				input.data.visibility,
				input.data.groupId ?? null,
			],
		);
		return context.json(row, 201);
	});

	app.post("/api/tasks", async (context) => {
		const ownerId = await plannerOwner(auth, context);
		const input = await parseBody(context, taskSchema);
		if (!ownerId) return unauthorized(context);
		if (!input.success) return badRequest(context);
		const category = await auth.planner.query<QueryRow>(
			"SELECT id FROM category WHERE id = $1 AND owner_id = $2",
			[input.data.categoryId, ownerId],
		);
		if (!category[0]) return notFound(context);
		const [row] = await auth.planner.query<QueryRow>(
			`INSERT INTO task (id, owner_id, category_id, title, date, position)
			 VALUES ($1, $2, $3, $4, $5, (SELECT COALESCE(MAX(position), -1) + 1 FROM task WHERE owner_id = $2 AND category_id = $3 AND date IS NOT DISTINCT FROM $5))
			 RETURNING id, title, completed, completed_at AS "completedAt", date, position`,
			[crypto.randomUUID(), ownerId, input.data.categoryId, input.data.title, input.data.date],
		);
		return context.json(taskResponse(row ?? {}), 201);
	});

	app.patch("/api/tasks/:id", async (context) => {
		const ownerId = await plannerOwner(auth, context);
		const id = z.uuid().safeParse(context.req.param("id"));
		const input = await parseBody(context, taskPatchSchema);
		if (!ownerId) return unauthorized(context);
		if (!id.success || !input.success) return badRequest(context);
		const [current] = await auth.planner.query<QueryRow>(
			"SELECT category_id AS \"categoryId\", date FROM task WHERE id = $1 AND owner_id = $2",
			[id.data, ownerId],
		);
		if (!current) return notFound(context);
		const currentDate = current.date === null ? null : String(current.date);
		const date = input.data.date === undefined ? currentDate : input.data.date;
		const position =
			input.data.position ??
			(date === currentDate
				? null
				: await nextTaskPosition(auth, ownerId, String(current.categoryId), date));
		const [row] = await auth.planner.query<QueryRow>(
			`UPDATE task SET title = COALESCE($3, title), date = $4, position = COALESCE($5, position)
			 WHERE id = $1 AND owner_id = $2
			 RETURNING id, title, completed, completed_at AS "completedAt", date, position`,
			[id.data, ownerId, input.data.title ?? null, date, position],
		);
		return context.json(taskResponse(row ?? {}));
	});

	app.put("/api/tasks/:id/completion", async (context) => {
		const ownerId = await plannerOwner(auth, context);
		const id = z.uuid().safeParse(context.req.param("id"));
		const input = await parseBody(context, completionSchema);
		if (!ownerId) return unauthorized(context);
		if (!id.success || !input.success) return badRequest(context);
		const [row] = await auth.planner.query<QueryRow>(
			`UPDATE task SET completed = $3, completed_at = CASE WHEN $3 THEN $4::timestamptz ELSE NULL END
			 WHERE id = $1 AND owner_id = $2
			 RETURNING id, title, completed, completed_at AS "completedAt", date, position`,
			[id.data, ownerId, input.data.completed, new Date().toISOString()],
		);
		return row ? context.json(taskResponse(row)) : notFound(context);
	});

	app.get("/api/backlog", async (context) => {
		const ownerId = await plannerOwner(auth, context);
		if (!ownerId) return unauthorized(context);
		const rows = await auth.planner.query<QueryRow>(
			`SELECT id, title, completed, completed_at AS "completedAt", date, position
			 FROM task WHERE owner_id = $1 AND date IS NULL ORDER BY position, created_at`,
			[ownerId],
		);
		return context.json({ tasks: rows.map(taskResponse) });
	});
}
