import type { Context } from "hono";
import { z } from "zod";
import type { AuthRuntime } from "../auth/runtime";

export type QueryRow = Record<string, unknown>;

export async function plannerOwner(auth: AuthRuntime, context: Context) {
	const session = await auth.getSession(context.req.raw.headers);
	return session?.user?.id ?? null;
}

export function unauthorized(context: Context) {
	return context.json({ error: { code: "UNAUTHORIZED" } }, 401);
}

export function badRequest(context: Context) {
	return context.json({ error: { code: "INVALID_REQUEST" } }, 400);
}

export function notFound(context: Context) {
	return context.json({ error: { code: "NOT_FOUND" } }, 404);
}

export function timestamp(value: unknown) {
	if (value === null || value === undefined) return null;
	return value instanceof Date ? value.toISOString() : String(value);
}

export function taskResponse(row: QueryRow) {
	return {
		id: String(row.id),
		title: String(row.title),
		completed: Boolean(row.completed),
		completedAt: timestamp(row.completedAt),
		date: row.date === null ? null : String(row.date),
		position: Number(row.position),
	};
}

function routineDays(value: unknown) {
	if (Array.isArray(value)) return value.map(Number);
	if (typeof value !== "string") return [];
	try {
		const parsed = z.array(z.number()).safeParse(JSON.parse(value));
		return parsed.success ? parsed.data : [];
	} catch {
		return [];
	}
}

export function routineResponse(row: QueryRow) {
	const type = String(row.frequencyType);
	const days = routineDays(row.frequencyDays);
	return {
		id: String(row.id),
		categoryId: String(row.categoryId),
		title: String(row.title),
		startDate: String(row.startDate),
		endDate: row.endDate === null ? null : String(row.endDate),
		frequency:
			type === "daily"
				? { type: "daily" as const }
				: { type: type === "monthly" ? ("monthly" as const) : ("weekdays" as const), days },
		status: row.status === "paused" ? ("paused" as const) : ("active" as const),
	};
}

export function appliesOnDate(row: QueryRow, localDate: string) {
	const type = String(row.frequencyType);
	if (type === "daily") return true;
	const [year, month, day] = localDate.split("-").map(Number);
	if (year === undefined || month === undefined || day === undefined) return false;
	const days = routineDays(row.frequencyDays);
	return type === "weekdays"
		? days.includes(new Date(Date.UTC(year, month - 1, day)).getUTCDay())
		: type === "monthly" && days.includes(day);
}

export async function nextTaskPosition(
	auth: AuthRuntime,
	ownerId: string,
	categoryId: string,
	date: string | null,
) {
	const [row] = await auth.planner.query<QueryRow>(
		"SELECT COALESCE(MAX(position), -1) + 1 AS position FROM task WHERE owner_id = $1 AND category_id = $2 AND date IS NOT DISTINCT FROM $3",
		[ownerId, categoryId, date],
	);
	return Number(row?.position ?? 0);
}
