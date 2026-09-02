import { sql } from "drizzle-orm";
import {
	bigint,
	check,
	index,
	pgTable,
	primaryKey,
	text,
	timestamp,
	uniqueIndex,
} from "drizzle-orm/pg-core";
import { user } from "./auth";
import { socialGroup } from "./social";

export const chatRoom = pgTable(
	"chat_room",
	{
		id: text("id").primaryKey(),
		kind: text("kind").notNull(),
		groupId: text("group_id").references(() => socialGroup.id, { onDelete: "cascade" }),
		directKey: text("direct_key"),
		nextSequence: bigint("next_sequence", { mode: "number" }).default(0).notNull(),
		lastMessageAt: timestamp("last_message_at", { withTimezone: true }),
		createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
	},
	(table) => [
		check("chat_room_kind_check", sql`${table.kind} IN ('group', 'dm')`),
		check(
			"chat_room_shape_check",
			sql`(${table.kind} = 'group' AND ${table.groupId} IS NOT NULL AND ${table.directKey} IS NULL) OR (${table.kind} = 'dm' AND ${table.groupId} IS NULL AND ${table.directKey} IS NOT NULL)`,
		),
		check("chat_room_next_sequence_check", sql`${table.nextSequence} >= 0`),
		uniqueIndex("chat_room_group_id_uidx").on(table.groupId),
		uniqueIndex("chat_room_direct_key_uidx").on(table.directKey),
	],
);

export const chatRoomMember = pgTable(
	"chat_room_member",
	{
		roomId: text("room_id")
			.notNull()
			.references(() => chatRoom.id, { onDelete: "cascade" }),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		joinedSequence: bigint("joined_sequence", { mode: "number" }).default(0).notNull(),
		lastReadSequence: bigint("last_read_sequence", { mode: "number" }).default(0).notNull(),
		lastReadAt: timestamp("last_read_at", { withTimezone: true }),
		createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
	},
	(table) => [
		primaryKey({ columns: [table.roomId, table.userId] }),
		check("chat_room_member_joined_sequence_check", sql`${table.joinedSequence} >= 0`),
		check("chat_room_member_last_read_sequence_check", sql`${table.lastReadSequence} >= 0`),
		check(
			"chat_room_member_cursor_check",
			sql`${table.lastReadSequence} >= ${table.joinedSequence}`,
		),
		index("chat_room_member_user_id_idx").on(table.userId),
	],
);

export const chatMessage = pgTable(
	"chat_message",
	{
		id: text("id").primaryKey(),
		roomId: text("room_id")
			.notNull()
			.references(() => chatRoom.id, { onDelete: "cascade" }),
		senderId: text("sender_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		sequence: bigint("sequence", { mode: "number" }).notNull(),
		clientMessageId: text("client_message_id").notNull(),
		body: text("body").notNull(),
		createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
	},
	(table) => [
		check("chat_message_sequence_check", sql`${table.sequence} > 0`),
		check("chat_message_body_check", sql`char_length(btrim(${table.body})) BETWEEN 1 AND 4000`),
		uniqueIndex("chat_message_room_sequence_uidx").on(table.roomId, table.sequence),
		uniqueIndex("chat_message_sender_client_message_uidx").on(
			table.senderId,
			table.clientMessageId,
		),
		index("chat_message_room_sequence_idx").on(table.roomId, table.sequence),
	],
);
