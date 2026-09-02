import type { Hono } from "hono";
import { z } from "zod";
import type { AuthRuntime } from "../auth/runtime";
import {
	appliesOnDate,
	badRequest,
	notFound,
	plannerOwner,
	timestamp,
	type QueryRow,
	unauthorized,
} from "./shared";
import { completionSchema, localDateSchema, parseBody, routineSchema } from "./validation";

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
			 RETURNING id, title, start_date AS "startDate", end_date AS "endDate", frequency_type AS "frequencyType", frequency_days AS "frequencyDays"`,
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
		return context.json(row, 201);
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
			 FROM routine WHERE id = $1 AND owner_id = $2 AND start_date <= $3 AND (end_date IS NULL OR end_date >= $3)`,
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
