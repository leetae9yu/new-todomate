import type { Hono } from "hono";
import { z } from "zod";
import type { AuthRuntime } from "../auth/runtime";
import {
	appliesOnDate,
	badRequest,
	notFound,
	plannerOwner,
	routineResponse,
	timestamp,
	type QueryRow,
	unauthorized,
} from "./shared";
import {
	completionSchema,
	localDateSchema,
	parseBody,
	routinePatchSchema,
	routineSchema,
} from "./validation";

export function installRoutineRoutes(app: Hono, auth: AuthRuntime) {
	app.post("/api/routines", async (context) => {
		const ownerId = await plannerOwner(auth, context);
		const input = await parseBody(context, routineSchema);
		if (!ownerId) return unauthorized(context);
		if (!input.success) return badRequest(context);
		const category = await auth.planner.query<QueryRow>(
			"SELECT id FROM category WHERE id = $1 AND owner_id = $2",
			[input.data.categoryId, ownerId],
		);
		if (!category[0]) return notFound(context);
		const [row] = await auth.planner.query<QueryRow>(
			`INSERT INTO routine (id, owner_id, category_id, title, start_date, end_date, frequency_type, frequency_days)
			 VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)
			 RETURNING id, category_id AS "categoryId", title, start_date AS "startDate", end_date AS "endDate",
			 frequency_type AS "frequencyType", frequency_days AS "frequencyDays", status`,
			[
				crypto.randomUUID(),
				ownerId,
				input.data.categoryId,
				input.data.title,
				input.data.startDate,
				input.data.endDate ?? null,
				input.data.frequency.type,
				JSON.stringify(input.data.frequency.type === "daily" ? [] : input.data.frequency.days),
			],
		);
		return context.json(routineResponse(row ?? {}), 201);
	});

	app.get("/api/routines", async (context) => {
		const ownerId = await plannerOwner(auth, context);
		if (!ownerId) return unauthorized(context);
		const rows = await auth.planner.query<QueryRow>(
			`SELECT r.id, r.category_id AS "categoryId", r.title, r.start_date AS "startDate",
			 r.end_date AS "endDate", r.frequency_type AS "frequencyType", r.frequency_days AS "frequencyDays", r.status
			 FROM routine r JOIN category c ON c.id = r.category_id
			 WHERE r.owner_id = $1 ORDER BY c.position, c.created_at, c.id, r.created_at, r.id`,
			[ownerId],
		);
		return context.json({ routines: rows.map(routineResponse) });
	});

	app.patch("/api/routines/:id", async (context) => {
		const ownerId = await plannerOwner(auth, context);
		const id = z.uuid().safeParse(context.req.param("id"));
		const input = await parseBody(context, routinePatchSchema);
		if (!ownerId) return unauthorized(context);
		if (!id.success || !input.success) return badRequest(context);
		if ("status" in input.data) {
			const [row] = await auth.planner.query<QueryRow>(
				`UPDATE routine SET status = $3 WHERE id = $1 AND owner_id = $2
				 RETURNING id, category_id AS "categoryId", title, start_date AS "startDate", end_date AS "endDate",
				 frequency_type AS "frequencyType", frequency_days AS "frequencyDays", status`,
				[id.data, ownerId, input.data.status],
			);
			return row ? context.json(routineResponse(row)) : notFound(context);
		}
		const category = await auth.planner.query<QueryRow>(
			"SELECT id FROM category WHERE id = $1 AND owner_id = $2",
			[input.data.categoryId, ownerId],
		);
		if (!category[0]) return notFound(context);
		const [row] = await auth.planner.query<QueryRow>(
			`UPDATE routine SET category_id = $3, title = $4, start_date = $5, end_date = $6,
			 frequency_type = $7, frequency_days = $8::jsonb WHERE id = $1 AND owner_id = $2
			 RETURNING id, category_id AS "categoryId", title, start_date AS "startDate", end_date AS "endDate",
			 frequency_type AS "frequencyType", frequency_days AS "frequencyDays", status`,
			[
				id.data,
				ownerId,
				input.data.categoryId,
				input.data.title,
				input.data.startDate,
				input.data.endDate ?? null,
				input.data.frequency.type,
				JSON.stringify(input.data.frequency.type === "daily" ? [] : input.data.frequency.days),
			],
		);
		return row ? context.json(routineResponse(row)) : notFound(context);
	});

	app.delete("/api/routines/:id", async (context) => {
		const ownerId = await plannerOwner(auth, context);
		const id = z.uuid().safeParse(context.req.param("id"));
		if (!ownerId) return unauthorized(context);
		if (!id.success) return badRequest(context);
		const [row] = await auth.planner.query<QueryRow>(
			"DELETE FROM routine WHERE id = $1 AND owner_id = $2 RETURNING id",
			[id.data, ownerId],
		);
		return row ? context.body(null, 204) : notFound(context);
	});

	app.put("/api/routines/:id/occurrences/:date/completion", async (context) => {
		const ownerId = await plannerOwner(auth, context);
		const id = z.uuid().safeParse(context.req.param("id"));
		const date = localDateSchema.safeParse(context.req.param("date"));
		const input = await parseBody(context, completionSchema);
		if (!ownerId) return unauthorized(context);
		if (!id.success || !date.success || !input.success) return badRequest(context);
		const [routine] = await auth.planner.query<QueryRow>(
			`SELECT id, category_id AS "categoryId", title, start_date AS "startDate", end_date AS "endDate",
			 frequency_type AS "frequencyType", frequency_days AS "frequencyDays"
			 FROM routine WHERE id = $1 AND owner_id = $2 AND status = 'active'
			 AND start_date <= $3 AND (end_date IS NULL OR end_date >= $3)`,
			[id.data, ownerId, date.data],
		);
		if (!routine || !appliesOnDate(routine, date.data)) return notFound(context);
		const [row] = await auth.planner.query<QueryRow>(
			`INSERT INTO routine_occurrence (routine_id, owner_id, date, completed, completed_at)
			 VALUES ($1, $2, $3, $4, CASE WHEN $4 THEN $5::timestamptz ELSE NULL END)
			 ON CONFLICT (routine_id, date) DO UPDATE SET completed = EXCLUDED.completed, completed_at = EXCLUDED.completed_at
			 RETURNING routine_id AS "routineId", date, completed, completed_at AS "completedAt"`,
			[id.data, ownerId, date.data, input.data.completed, new Date().toISOString()],
		);
		return context.json({ ...row, completedAt: timestamp(row?.completedAt) });
	});
}
