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
import {
	categoryPatchSchema,
	categorySchema,
	completionSchema,
	parseBody,
	taskPatchSchema,
	taskSchema,
} from "./validation";

export function installTaskRoutes(app: Hono, auth: AuthRuntime) {
	app.post("/api/categories", async (context) => {
		const ownerId = await plannerOwner(auth, context);
		const input = await parseBody(context, categorySchema);
		if (!ownerId) return unauthorized(context);
		if (!input.success) return badRequest(context);
		const groupId = input.data.groupId;
		if (groupId) {
			const membership = await auth.planner.query<QueryRow>(
				"SELECT 1 FROM group_membership WHERE group_id = $1 AND user_id = $2",
				[groupId, ownerId],
			);
			if (!membership[0]) return notFound(context);
		}
		const [row] = await auth.planner.query<QueryRow>(
			`INSERT INTO category (id, owner_id, name, color, visibility, position, group_id)
			 VALUES ($1, $2, $3, $4, $5, (SELECT COALESCE(MAX(position), -1) + 1 FROM category WHERE owner_id = $2), $6)
			 RETURNING id, name, color, visibility, group_id AS "groupId", position`,
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

	app.patch("/api/categories/:id", async (context) => {
		const ownerId = await plannerOwner(auth, context);
		const id = z.uuid().safeParse(context.req.param("id"));
		const input = await parseBody(context, categoryPatchSchema);
		if (!ownerId) return unauthorized(context);
		if (!id.success || !input.success) return badRequest(context);
		const [current] = await auth.planner.query<QueryRow>(
			`SELECT id, name, color, visibility, group_id AS "groupId", position
			 FROM category WHERE id = $1 AND owner_id = $2`,
			[id.data, ownerId],
		);
		if (!current) return notFound(context);

		const update = input.data;
		if (isCategoryReorder(update)) {
			const [count] = await auth.planner.query<QueryRow>(
				"SELECT COUNT(*)::integer AS count FROM category WHERE owner_id = $1",
				[ownerId],
			);
			if (update.position >= Number(count?.count ?? 0)) return badRequest(context);
			await auth.planner.query(
				`WITH ordered AS (
					SELECT id, ROW_NUMBER() OVER (ORDER BY position, created_at, id) - 1 AS old_position
					FROM category WHERE owner_id = $1
				), moved AS (
					SELECT id, CASE
						WHEN id = $2 THEN $3
						WHEN old_position < (SELECT old_position FROM ordered WHERE id = $2) AND old_position >= $3 THEN old_position + 1
						WHEN old_position > (SELECT old_position FROM ordered WHERE id = $2) AND old_position <= $3 THEN old_position - 1
						ELSE old_position
					END AS position FROM ordered
				)
				UPDATE category SET position = moved.position FROM moved WHERE category.id = moved.id`,
				[ownerId, id.data, update.position],
			);
		} else {
			const visibility = update.visibility ?? String(current.visibility);
			const groupId =
				visibility === "private"
					? null
					: update.groupId === undefined
						? current.groupId === null
							? null
							: String(current.groupId)
						: update.groupId;
			if (visibility === "group" && !groupId) return badRequest(context);
			if (visibility === "group") {
				const membership = await auth.planner.query<QueryRow>(
					"SELECT 1 FROM group_membership WHERE group_id = $1 AND user_id = $2",
					[groupId, ownerId],
				);
				if (!membership[0]) return notFound(context);
			}
			await auth.planner.query(
				`UPDATE category SET name = $3, color = $4, visibility = $5, group_id = $6
				 WHERE id = $1 AND owner_id = $2`,
				[
					id.data,
					ownerId,
					update.name ?? String(current.name),
					update.color ?? String(current.color),
					visibility,
					groupId,
				],
			);
		}
		const categories = await categoryRecords(auth, ownerId);
		const category = categories.find((item) => item.id === id.data);
		return context.json({
			category: isCategoryReorder(update) ? { id: id.data, position: Number(category?.position) } : category,
			categories: isCategoryReorder(update)
				? categories.map(({ id: categoryId, position }) => ({ id: categoryId, position }))
				: categories,
		});
	});

	app.delete("/api/categories/:id", async (context) => {
		const ownerId = await plannerOwner(auth, context);
		const id = z.uuid().safeParse(context.req.param("id"));
		if (!ownerId) return unauthorized(context);
		if (!id.success) return badRequest(context);
		const [row] = await auth.planner.query<QueryRow>(
			"DELETE FROM category WHERE id = $1 AND owner_id = $2 RETURNING id",
			[id.data, ownerId],
		);
		return row ? context.body(null, 204) : notFound(context);
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

function isCategoryReorder(value: unknown): value is { position: number } {
	return typeof value === "object" && value !== null && "position" in value;
}

async function categoryRecords(auth: AuthRuntime, ownerId: string) {
	const rows = await auth.planner.query<QueryRow>(
		`SELECT id, name, color, visibility, group_id AS "groupId", position
		 FROM category WHERE owner_id = $1 ORDER BY position, created_at, id`,
		[ownerId],
	);
	return rows.map((row) => ({
		id: String(row.id),
		name: String(row.name),
		color: String(row.color),
		visibility: String(row.visibility),
		groupId: row.groupId === null ? null : String(row.groupId),
		position: Number(row.position),
	}));
}
