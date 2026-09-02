import type { Context } from "hono";
import type { AuthRuntime } from "../auth/runtime";
import type { QueryRow } from "../planner/shared";
import { membership, socialUser } from "../social/shared";

export type RoomAccess = {
	id: string;
	kind: "group" | "dm";
	groupId: string | null;
	nextSequence: number;
	joinedSequence: number;
	lastReadSequence: number;
};

export function groupRoomId(groupId: string) {
	return `group:${groupId}`;
}

export function directRoomId(firstUserId: string, secondUserId: string) {
	return `dm:${[firstUserId, secondUserId].sort().join(":")}`;
}

export function isCanonicalRoomId(roomId: string) {
	const group =
		/^group:([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/i.exec(
			roomId,
		);
	if (group) return true;
	const direct = /^dm:([^:]+):([^:]+)$/.exec(roomId);
	const first = direct?.[1];
	const second = direct?.[2];
	return first !== undefined && second !== undefined && first !== second && first < second;
}

export async function chatActor(auth: AuthRuntime, context: Context) {
	const userId = await socialUser(auth, context);
	if (!userId) return null;
	const [user] = await auth.planner.query<QueryRow>(
		`SELECT id FROM "user" WHERE id = $1 AND status = 'active'`,
		[userId],
	);
	return user ? userId : null;
}

export async function requireRoomAccess(
	auth: AuthRuntime,
	roomId: string,
	actorId: string,
): Promise<RoomAccess | null> {
	const [row] = await auth.planner.query<QueryRow>(
		`SELECT r.id, r.kind, r.group_id AS "groupId", r.next_sequence AS "nextSequence",
		        m.joined_sequence AS "joinedSequence", m.last_read_sequence AS "lastReadSequence"
		 FROM chat_room r
		 JOIN chat_room_member m ON m.room_id = r.id AND m.user_id = $2
		 WHERE r.id = $1`,
		[roomId, actorId],
	);
	if (!row || (row.kind !== "group" && row.kind !== "dm")) return null;
	if (
		row.kind === "group" &&
		(!row.groupId || !(await membership(auth, String(row.groupId), actorId)))
	) {
		return null;
	}
	return {
		id: String(row.id),
		kind: row.kind,
		groupId: row.groupId === null ? null : String(row.groupId),
		nextSequence: Number(row.nextSequence),
		joinedSequence: Number(row.joinedSequence),
		lastReadSequence: Number(row.lastReadSequence),
	};
}

export function asTimestamp(value: unknown) {
	if (value instanceof Date) return value.toISOString();
	return String(value);
}
