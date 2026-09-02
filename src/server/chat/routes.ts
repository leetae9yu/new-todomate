import type { Hono } from "hono";
import { z } from "zod";
import type { AuthRuntime } from "../auth/runtime";
import { badRequest, notFound, type QueryRow, unauthorized } from "../planner/shared";
import type { ChatGateway, ChatMessage } from "./contracts";
import {
	asTimestamp,
	chatActor,
	directRoomId,
	isCanonicalRoomId,
	type RoomAccess,
	requireRoomAccess,
} from "./shared";

const dmSchema = z.object({ participantId: z.string().min(1).max(255) }).strict();
const messageSchema = z
	.object({ clientMessageId: z.uuid(), body: z.string() })
	.strict()
	.transform((value, context) => {
		const body = value.body.trim();
		if (body.length < 1 || body.length > 4_000) {
			context.addIssue({ code: "custom", message: "Message body must be 1 to 4000 characters." });
			return z.NEVER;
		}
		return { ...value, body };
	});
const readSchema = z.object({ throughSequence: z.number().int().nonnegative() }).strict();

type RoomSummary = {
	id: string;
	kind: "group" | "dm";
	groupId?: string;
	title: string;
	members: Array<{ id: string; name: string; image: string | null }>;
	lastMessage: ChatMessage | null;
	lastMessageAt: string | null;
	joinedSequence: number;
	lastReadSequence: number;
	unreadCount: number;
};

export function installChatRoutes(app: Hono, auth: AuthRuntime, gateway?: ChatGateway) {
	app.get("/api/chat/contacts", async (context) => {
		const actorId = await chatActor(auth, context);
		if (!actorId) return unauthorized(context);
		const contacts = await auth.planner.query<QueryRow>(
			`SELECT DISTINCT u.id, u.name, u.image
			 FROM "user" u
			 JOIN group_membership theirs ON theirs.user_id = u.id
			 JOIN group_membership mine ON mine.group_id = theirs.group_id
			 WHERE mine.user_id = $1 AND u.id <> $1 AND u.status = 'active'
			 ORDER BY u.name, u.id`,
			[actorId],
		);
		return context.json({
			contacts: contacts.map((contact) => ({
				id: String(contact.id),
				name: String(contact.name),
				image: contact.image === null ? null : String(contact.image),
			})),
		});
	});

	app.get("/api/chat/rooms", async (context) => {
		const actorId = await chatActor(auth, context);
		if (!actorId) return unauthorized(context);
		const rows = await auth.planner.query<QueryRow>(
			`WITH authorized_rooms AS (
			 SELECT r.id, r.kind, r.group_id, r.next_sequence, r.created_at,
			        m.joined_sequence, m.last_read_sequence
			 FROM chat_room r
			 JOIN chat_room_member m ON m.room_id = r.id AND m.user_id = $1
			 WHERE r.kind = 'dm' OR EXISTS (
				 SELECT 1 FROM group_membership gm
				 WHERE gm.group_id = r.group_id AND gm.user_id = $1
			 )
			)
			SELECT room.id, room.kind, room.group_id AS "groupId",
			       room.joined_sequence AS "joinedSequence",
			       room.last_read_sequence AS "lastReadSequence",
			       COALESCE(sg.name, dm_peer.name, '') AS title,
			       COALESCE(group_members.members, dm_members.members, '[]'::jsonb) AS members,
			       latest.id AS "lastMessageId",
			       latest.room_id AS "lastMessageRoomId",
			       latest.sequence AS "lastMessageSequence",
			       latest.client_message_id AS "lastMessageClientMessageId",
			       latest.body AS "lastMessageBody",
			       latest.created_at AS "lastMessageCreatedAt",
			       latest.sender_id AS "lastMessageSenderId",
			       latest.sender_name AS "lastMessageSenderName",
			       latest.sender_image AS "lastMessageSenderImage",
			       COALESCE(unread.count, 0) AS "unreadCount"
			 FROM authorized_rooms room
			 LEFT JOIN social_group sg ON room.kind = 'group' AND sg.id = room.group_id
			 LEFT JOIN LATERAL (
				 SELECT u.name FROM chat_room_member peer
				 JOIN "user" u ON u.id = peer.user_id
				 WHERE room.kind = 'dm' AND peer.room_id = room.id AND peer.user_id <> $1
				 ORDER BY peer.created_at LIMIT 1
			 ) dm_peer ON true
			 LEFT JOIN LATERAL (
				 SELECT jsonb_agg(
					 jsonb_build_object('id', u.id, 'name', u.name, 'image', u.image)
					 ORDER BY gm.created_at
				 ) AS members
				 FROM group_membership gm JOIN "user" u ON u.id = gm.user_id
				 WHERE room.kind = 'group' AND gm.group_id = room.group_id
			 ) group_members ON true
			 LEFT JOIN LATERAL (
				 SELECT jsonb_agg(
					 jsonb_build_object('id', u.id, 'name', u.name, 'image', u.image)
					 ORDER BY peer.created_at
				 ) AS members
				 FROM chat_room_member peer JOIN "user" u ON u.id = peer.user_id
				 WHERE room.kind = 'dm' AND peer.room_id = room.id AND peer.user_id <> $1
			 ) dm_members ON true
			 LEFT JOIN LATERAL (
				 SELECT message.id, message.room_id, message.sequence, message.client_message_id,
				        message.body, message.created_at, sender.id AS sender_id,
				        sender.name AS sender_name, sender.image AS sender_image
				 FROM chat_message message JOIN "user" sender ON sender.id = message.sender_id
				 WHERE message.room_id = room.id AND message.sequence > room.joined_sequence
				 ORDER BY message.sequence DESC LIMIT 1
			 ) latest ON true
			 LEFT JOIN LATERAL (
				 SELECT COUNT(*) AS count FROM chat_message message
				 WHERE message.room_id = room.id
				   AND message.sequence > room.joined_sequence
				   AND message.sequence > room.last_read_sequence
				   AND message.sender_id <> $1
			 ) unread ON true
			 ORDER BY latest.created_at DESC NULLS LAST, room.created_at DESC`,
			[actorId],
		);
		return context.json({ rooms: rows.map(roomSummaryFromRow) });
	});

	app.post("/api/chat/dms", async (context) => {
		const actorId = await chatActor(auth, context);
		const input = dmSchema.safeParse(await context.req.json().catch(() => null));
		if (!actorId) return unauthorized(context);
		if (!input.success || input.data.participantId === actorId) return badRequest(context);
		const participantId = input.data.participantId;
		const [target] = await auth.planner.query<QueryRow>(
			`SELECT id FROM "user" WHERE id = $1 AND status = 'active'`,
			[participantId],
		);
		if (!target) return notFound(context);
		const [sharedGroup] = await auth.planner.query<QueryRow>(
			`SELECT 1 FROM group_membership mine
			 JOIN group_membership theirs ON theirs.group_id = mine.group_id
			 WHERE mine.user_id = $1 AND theirs.user_id = $2 LIMIT 1`,
			[actorId, participantId],
		);
		if (!sharedGroup) return context.json({ error: { code: "FORBIDDEN" } }, 403);

		const roomId = directRoomId(actorId, participantId);
		const inserted = await auth.planner.query<QueryRow>(
			`INSERT INTO chat_room (id, kind, direct_key)
			 VALUES ($1, 'dm', $1)
			 ON CONFLICT (direct_key) DO NOTHING
			 RETURNING id`,
			[roomId],
		);
		await auth.planner.query(
			`INSERT INTO chat_room_member (room_id, user_id, joined_sequence, last_read_sequence)
			 VALUES ($1, $2, 0, 0), ($1, $3, 0, 0)
			 ON CONFLICT (room_id, user_id) DO NOTHING`,
			[roomId, actorId, participantId],
		);
		const access = await requireRoomAccess(auth, roomId, actorId);
		if (!access) return notFound(context);
		const [newlySharedSinceRoom] = inserted[0]
			? [{ present: true }]
			: await auth.planner.query<QueryRow>(
				`SELECT EXISTS (
					SELECT 1 FROM group_membership mine
					JOIN group_membership theirs ON theirs.group_id = mine.group_id
					JOIN chat_room room ON room.id = $3
					WHERE mine.user_id = $1 AND theirs.user_id = $2
					  AND (mine.created_at > room.created_at OR theirs.created_at > room.created_at)
				) AS present`,
				[actorId, participantId, roomId],
			);
		return context.json(
			await roomSummary(auth, access, actorId),
			newlySharedSinceRoom?.present ? 201 : 200,
		);
	});

	app.get("/api/chat/rooms/:roomId/messages", async (context) => {
		const actorId = await chatActor(auth, context);
		if (!actorId) return unauthorized(context);
		const roomId = context.req.param("roomId");
		if (!isCanonicalRoomId(roomId)) return badRequest(context);
		const access = await requireRoomAccess(auth, roomId, actorId);
		if (!access) return notFound(context);
		const page = parsePage(context.req.url);
		if (!page) return badRequest(context);
		const messages = await history(auth, access, page);
		const first = messages[0]?.sequence;
		const last = messages.at(-1)?.sequence;
		const olderBoundary = first ?? page.beforeSequence ?? access.joinedSequence + 1;
		const newerBoundary = last ?? page.afterSequence ?? access.nextSequence;
		const [older] = await auth.planner.query<QueryRow>(
			`SELECT EXISTS (
				 SELECT 1 FROM chat_message
				 WHERE room_id = $1 AND sequence > $2 AND sequence < $3
			 ) AS present`,
			[roomId, access.joinedSequence, olderBoundary],
		);
		const [newer] = await auth.planner.query<QueryRow>(
			`SELECT EXISTS (
				 SELECT 1 FROM chat_message
				 WHERE room_id = $1 AND sequence > $2 AND sequence > $3
			 ) AS present`,
			[roomId, access.joinedSequence, newerBoundary],
		);
		return context.json({
			messages,
			joinedSequence: access.joinedSequence,
			latestSequence: access.nextSequence,
			hasOlder: Boolean(older?.present),
			hasNewer: Boolean(newer?.present),
		});
	});

	app.post("/api/chat/rooms/:roomId/messages", async (context) => {
		const actorId = await chatActor(auth, context);
		const input = messageSchema.safeParse(await context.req.json().catch(() => null));
		if (!actorId) return unauthorized(context);
		if (!isCanonicalRoomId(context.req.param("roomId")) || !input.success)
			return badRequest(context);
		const roomId = context.req.param("roomId");
		const access = await requireRoomAccess(auth, roomId, actorId);
		if (!access) return notFound(context);
		const existing = await messageByClientId(auth, actorId, input.data.clientMessageId);
		if (existing) {
			if (existing.roomId !== roomId) {
				return context.json({ error: { code: "CLIENT_MESSAGE_ID_REUSED" } }, 409);
			}
			return context.json(existing);
		}

		const messageId = crypto.randomUUID();
		try {
			const [created] = await auth.planner.query<QueryRow>(
				`WITH advanced_room AS (
					UPDATE chat_room
					SET next_sequence = next_sequence + 1, last_message_at = now()
					WHERE id = $1
					RETURNING next_sequence
				)
				INSERT INTO chat_message (id, room_id, sender_id, sequence, client_message_id, body)
				SELECT $2, $1, $3, next_sequence, $4, $5 FROM advanced_room
				RETURNING id`,
				[roomId, messageId, actorId, input.data.clientMessageId, input.data.body],
			);
			if (!created) return notFound(context);
		} catch (error) {
			const replay = await messageByClientId(auth, actorId, input.data.clientMessageId);
			if (replay) {
				if (replay.roomId !== roomId) {
					return context.json({ error: { code: "CLIENT_MESSAGE_ID_REUSED" } }, 409);
				}
				return context.json(replay);
			}
			throw error;
		}
		const message = await messageById(auth, messageId);
		if (!message) return notFound(context);
		await auth.planner.query(
			`UPDATE chat_room_member
			 SET last_read_sequence = GREATEST(last_read_sequence, $3), last_read_at = now()
			 WHERE room_id = $1 AND user_id = $2`,
			[roomId, actorId, message.sequence],
		);
		if (gateway) {
			try {
				await gateway.publish(roomId, { type: "message.created", roomId, message });
			} catch (error) {
				console.error("Failed to broadcast persisted chat message", error);
			}
		}
		return context.json(message, 201);
	});

	app.patch("/api/chat/rooms/:roomId/read", async (context) => {
		const actorId = await chatActor(auth, context);
		const input = readSchema.safeParse(await context.req.json().catch(() => null));
		if (!actorId) return unauthorized(context);
		const roomId = context.req.param("roomId");
		if (!isCanonicalRoomId(roomId) || !input.success) return badRequest(context);
		const access = await requireRoomAccess(auth, roomId, actorId);
		if (!access) return notFound(context);
		if (
			input.data.throughSequence < access.joinedSequence ||
			input.data.throughSequence > access.nextSequence
		) {
			return badRequest(context);
		}
		const [member] = await auth.planner.query<QueryRow>(
			`UPDATE chat_room_member
			 SET last_read_sequence = GREATEST(last_read_sequence, $3), last_read_at = now()
			 WHERE room_id = $1 AND user_id = $2
			 RETURNING last_read_sequence AS "lastReadSequence"`,
			[roomId, actorId, input.data.throughSequence],
		);
		const lastReadSequence = Number(member?.lastReadSequence);
		return context.json({
			roomId,
			lastReadSequence,
			unreadCount: await unreadCount(
				auth,
				roomId,
				actorId,
				access.joinedSequence,
				lastReadSequence,
			),
		});
	});

	app.get("/api/chat/rooms/:roomId/live", async (context) => {
		const actorId = await chatActor(auth, context);
		if (!actorId) return unauthorized(context);
		const roomId = context.req.param("roomId");
		if (!isCanonicalRoomId(roomId)) return badRequest(context);
		if (!(await requireRoomAccess(auth, roomId, actorId))) return notFound(context);
		if (context.req.header("upgrade")?.toLowerCase() !== "websocket" || !gateway) {
			return context.json({ error: { code: "UPGRADE_REQUIRED" } }, 426);
		}
		return gateway.connect(roomId, actorId, context.req.raw);
	});
}

async function roomSummary(
	auth: AuthRuntime,
	access: RoomAccess,
	actorId: string,
): Promise<RoomSummary> {
	let title: string;
	let members: RoomSummary["members"];
	if (access.kind === "group") {
		const groupId = String(access.groupId);
		const [group] = await auth.planner.query<QueryRow>(
			"SELECT name FROM social_group WHERE id = $1",
			[groupId],
		);
		title = group ? String(group.name) : "";
		const rows = await auth.planner.query<QueryRow>(
			`SELECT u.id, u.name, u.image FROM group_membership gm
			 JOIN "user" u ON u.id = gm.user_id WHERE gm.group_id = $1 ORDER BY gm.created_at`,
			[groupId],
		);
		members = rows.map(userSummary);
	} else {
		const rows = await auth.planner.query<QueryRow>(
			`SELECT u.id, u.name, u.image FROM chat_room_member rm
			 JOIN "user" u ON u.id = rm.user_id
			 WHERE rm.room_id = $1 AND rm.user_id <> $2`,
			[access.id, actorId],
		);
		members = rows.map(userSummary);
		title = members[0]?.name ?? "";
	}
	const lastMessage = await latestMessage(auth, access.id, access.joinedSequence);
	return {
		id: access.id,
		kind: access.kind,
		...(access.groupId === null ? {} : { groupId: access.groupId }),
		title,
		members,
		lastMessage,
		lastMessageAt: lastMessage?.createdAt ?? null,
		joinedSequence: access.joinedSequence,
		lastReadSequence: access.lastReadSequence,
		unreadCount: await unreadCount(
			auth,
			access.id,
			actorId,
			access.joinedSequence,
			access.lastReadSequence,
		),
	};
}

function userSummary(row: QueryRow) {
	return {
		id: String(row.id),
		name: String(row.name),
		image: row.image === null ? null : String(row.image),
	};
}

function roomSummaryFromRow(row: QueryRow): RoomSummary {
	const lastMessage =
		row.lastMessageId === null
			? null
			: messageFromRow({
				id: row.lastMessageId,
				roomId: row.lastMessageRoomId,
				sequence: row.lastMessageSequence,
				clientMessageId: row.lastMessageClientMessageId,
				body: row.lastMessageBody,
				createdAt: row.lastMessageCreatedAt,
				senderId: row.lastMessageSenderId,
				senderName: row.lastMessageSenderName,
				senderImage: row.lastMessageSenderImage,
			});
	return {
		id: String(row.id),
		kind: row.kind === "group" ? "group" : "dm",
		...(row.groupId === null ? {} : { groupId: String(row.groupId) }),
		title: String(row.title),
		members: membersFromValue(row.members),
		lastMessage,
		lastMessageAt: lastMessage?.createdAt ?? null,
		joinedSequence: Number(row.joinedSequence),
		lastReadSequence: Number(row.lastReadSequence),
		unreadCount: Number(row.unreadCount),
	};
}

function membersFromValue(value: unknown): RoomSummary["members"] {
	let parsed = value;
	if (typeof value === "string") {
		try {
			parsed = JSON.parse(value);
		} catch {
			return [];
		}
	}
	if (!Array.isArray(parsed)) return [];
	return parsed.flatMap((member) => {
		if (typeof member !== "object" || member === null || !("id" in member) || !("name" in member)) {
			return [];
		}
		const image = "image" in member ? member.image : null;
		return [
			{
				id: String(member.id),
				name: String(member.name),
				image: image === null ? null : String(image),
			},
		];
	});
}

async function unreadCount(
	auth: AuthRuntime,
	roomId: string,
	actorId: string,
	joinedSequence: number,
	lastReadSequence: number,
) {
	const [row] = await auth.planner.query<QueryRow>(
		`SELECT COUNT(*) AS count FROM chat_message
		 WHERE room_id = $1 AND sequence > $2 AND sequence > $3 AND sender_id <> $4`,
		[roomId, joinedSequence, lastReadSequence, actorId],
	);
	return Number(row?.count ?? 0);
}

async function latestMessage(auth: AuthRuntime, roomId: string, joinedSequence: number) {
	const [row] = await auth.planner.query<QueryRow>(
		`SELECT m.id, m.room_id AS "roomId", m.sequence, m.client_message_id AS "clientMessageId",
		        m.body, m.created_at AS "createdAt", u.id AS "senderId", u.name AS "senderName", u.image AS "senderImage"
		 FROM chat_message m JOIN "user" u ON u.id = m.sender_id
		 WHERE m.room_id = $1 AND m.sequence > $2 ORDER BY m.sequence DESC LIMIT 1`,
		[roomId, joinedSequence],
	);
	return row ? messageFromRow(row) : null;
}

async function messageById(auth: AuthRuntime, messageId: string) {
	const [row] = await auth.planner.query<QueryRow>(
		`SELECT m.id, m.room_id AS "roomId", m.sequence, m.client_message_id AS "clientMessageId",
		        m.body, m.created_at AS "createdAt", u.id AS "senderId", u.name AS "senderName", u.image AS "senderImage"
		 FROM chat_message m JOIN "user" u ON u.id = m.sender_id WHERE m.id = $1`,
		[messageId],
	);
	return row ? messageFromRow(row) : null;
}

async function messageByClientId(auth: AuthRuntime, actorId: string, clientMessageId: string) {
	const [row] = await auth.planner.query<QueryRow>(
		`SELECT m.id, m.room_id AS "roomId", m.sequence, m.client_message_id AS "clientMessageId",
		        m.body, m.created_at AS "createdAt", u.id AS "senderId", u.name AS "senderName", u.image AS "senderImage"
		 FROM chat_message m JOIN "user" u ON u.id = m.sender_id
		 WHERE m.sender_id = $1 AND m.client_message_id = $2`,
		[actorId, clientMessageId],
	);
	return row ? messageFromRow(row) : null;
}

function messageFromRow(row: QueryRow): ChatMessage {
	return {
		id: String(row.id),
		roomId: String(row.roomId),
		sequence: Number(row.sequence),
		clientMessageId: String(row.clientMessageId),
		body: String(row.body),
		sender: {
			id: String(row.senderId),
			name: String(row.senderName),
			image: row.senderImage === null ? null : String(row.senderImage),
		},
		createdAt: asTimestamp(row.createdAt),
	};
}

type Page = { limit: number; beforeSequence?: number; afterSequence?: number };

function parsePage(requestUrl: string): Page | null {
	const params = new URL(requestUrl).searchParams;
	const entries = [...params.entries()];
	if (
		entries.some(([key]) => key !== "limit" && key !== "beforeSequence" && key !== "afterSequence")
	)
		return null;
	if (new Set(entries.map(([key]) => key)).size !== entries.length) return null;
	const parseInteger = (value: string | null, minimum: number) => {
		if (value === null || !/^(?:0|[1-9]\d*)$/.test(value)) return null;
		const result = Number(value);
		return Number.isSafeInteger(result) && result >= minimum ? result : null;
	};
	const limit = params.has("limit") ? parseInteger(params.get("limit"), 1) : 50;
	const beforeSequence = params.has("beforeSequence")
		? parseInteger(params.get("beforeSequence"), 1)
		: undefined;
	const afterSequence = params.has("afterSequence")
		? parseInteger(params.get("afterSequence"), 0)
		: undefined;
	if (
		limit === null ||
		beforeSequence === null ||
		afterSequence === null ||
		(beforeSequence !== undefined && afterSequence !== undefined) ||
		limit > 100
	)
		return null;
	return {
		limit,
		...(beforeSequence === undefined ? {} : { beforeSequence }),
		...(afterSequence === undefined ? {} : { afterSequence }),
	};
}

async function history(auth: AuthRuntime, access: RoomAccess, page: Page) {
	const fields = `SELECT m.id, m.room_id AS "roomId", m.sequence, m.client_message_id AS "clientMessageId",
		m.body, m.created_at AS "createdAt", u.id AS "senderId", u.name AS "senderName", u.image AS "senderImage"
		FROM chat_message m JOIN "user" u ON u.id = m.sender_id`;
	let rows: QueryRow[];
	if (page.afterSequence !== undefined) {
		rows = await auth.planner.query<QueryRow>(
			`${fields} WHERE m.room_id = $1 AND m.sequence > $2 AND m.sequence > $3 ORDER BY m.sequence LIMIT $4`,
			[access.id, access.joinedSequence, page.afterSequence, page.limit],
		);
	} else {
		const boundary = page.beforeSequence ?? access.nextSequence + 1;
		rows = await auth.planner.query<QueryRow>(
			`SELECT * FROM (${fields} WHERE m.room_id = $1 AND m.sequence > $2 AND m.sequence < $3 ORDER BY m.sequence DESC LIMIT $4) page ORDER BY sequence`,
			[access.id, access.joinedSequence, boundary, page.limit],
		);
	}
	return rows.map(messageFromRow);
}
