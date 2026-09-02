import type { Context } from "hono";
import type { AuthRuntime } from "../auth/runtime";
import { plannerOwner, type QueryRow } from "../planner/shared";

export async function socialUser(auth: AuthRuntime, context: Context) {
	return plannerOwner(auth, context);
}

export async function membership(
	auth: AuthRuntime,
	groupId: string,
	userId: string,
) {
	const [row] = await auth.planner.query<QueryRow>(
		"SELECT role FROM group_membership WHERE group_id = $1 AND user_id = $2",
		[groupId, userId],
	);
	return row ? String(row.role) : null;
}

export function jsonMetadata(value: unknown) {
	if (typeof value !== "string") return value;
	try {
		return JSON.parse(value) as unknown;
	} catch {
		return null;
	}
}
