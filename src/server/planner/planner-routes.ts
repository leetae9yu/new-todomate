import type { Hono } from "hono";
import { z } from "zod";
import type { AuthRuntime } from "../auth/runtime";
import {
	appliesOnDate,
	badRequest,
	plannerOwner,
	taskResponse,
	type QueryRow,
	timestamp,
	unauthorized,
} from "./shared";
import { localDateSchema } from "./validation";

export function installPlannerReadRoutes(app: Hono, auth: AuthRuntime) {
	app.get("/api/planner", async (context) => {
		const ownerId = await plannerOwner(auth, context);
		const input = z.object({ date: localDateSchema }).strict().safeParse(context.req.query());
		if (!ownerId) return unauthorized(context);
		if (!input.success) return badRequest(context);
		const date = input.data.date;
		const [categories, tasks, overdue, routineRows, occurrences] = await Promise.all([
			auth.planner.query<QueryRow>(
				"SELECT id, name, color, visibility, position FROM category WHERE owner_id = $1 ORDER BY position, created_at",
				[ownerId],
			),
			auth.planner.query<QueryRow>(
				`SELECT id, category_id AS "categoryId", title, completed, completed_at AS "completedAt", date, position
				 FROM task WHERE owner_id = $1 AND date = $2 ORDER BY position, created_at`,
				[ownerId, date],
			),
			auth.planner.query<QueryRow>(
				`SELECT id, title, date, completed, completed_at AS "completedAt", position
				 FROM task WHERE owner_id = $1 AND date < $2 AND NOT completed ORDER BY date, position`,
				[ownerId, date],
			),
			auth.planner.query<QueryRow>(
				`SELECT id, category_id AS "categoryId", title, start_date AS "startDate", end_date AS "endDate",
				 frequency_type AS "frequencyType", frequency_days AS "frequencyDays"
				 FROM routine WHERE owner_id = $1 AND status = 'active'
				 AND start_date <= $2 AND (end_date IS NULL OR end_date >= $2) ORDER BY created_at`,
				[ownerId, date],
			),
			auth.planner.query<QueryRow>(
				"SELECT routine_id AS \"routineId\", completed, completed_at AS \"completedAt\" FROM routine_occurrence WHERE owner_id = $1 AND date = $2",
				[ownerId, date],
			),
		]);
		const completedByRoutine = new Map(occurrences.map((row) => [String(row.routineId), row]));
		const compactCategories = tasks.length === 0 && routineRows.length === 0;
		return context.json({
			date,
			categories: categories.map((category) =>
				compactCategories
					? { id: category.id, position: Number(category.position) }
					: {
						id: category.id,
						name: category.name,
						color: category.color,
						visibility: category.visibility,
						position: Number(category.position),
						tasks: tasks.filter((task) => task.categoryId === category.id).map(taskResponse),
					},
			),
			overdue: overdue.map(taskResponse),
			routines: routineRows.filter((routine) => appliesOnDate(routine, date)).map((routine) => {
				const occurrence = completedByRoutine.get(String(routine.id));
				return {
					id: routine.id,
					categoryId: routine.categoryId,
					title: routine.title,
					completed: Boolean(occurrence?.completed),
					completedAt: timestamp(occurrence?.completedAt),
				};
			}),
		});
	});
}
