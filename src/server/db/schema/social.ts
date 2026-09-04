import { sql } from "drizzle-orm";
import {
	boolean,
	index,
	integer,
	jsonb,
	pgTable,
	text,
	timestamp,
	uniqueIndex,
} from "drizzle-orm/pg-core";
import { user } from "./auth";
import { task } from "./planner";

export const socialGroup = pgTable(
	"social_group",
	{
		id: text("id").primaryKey(),
		name: text("name").notNull(),
		ownerId: text("owner_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
	},
	(table) => [index("social_group_owner_id_idx").on(table.ownerId)],
);

export const groupMembership = pgTable(
	"group_membership",
	{
		groupId: text("group_id")
			.notNull()
			.references(() => socialGroup.id, { onDelete: "cascade" }),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		role: text("role").notNull(),
		createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
	},
	(table) => [
		uniqueIndex("group_membership_pk").on(table.groupId, table.userId),
		index("group_membership_user_id_idx").on(table.userId),
	],
);

export const groupInvite = pgTable(
	"group_invite",
	{
		id: text("id").primaryKey(),
		groupId: text("group_id")
			.notNull()
			.references(() => socialGroup.id, { onDelete: "cascade" }),
		createdBy: text("created_by")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		token: text("token").notNull(),
		codeHash: text("code_hash"),
		status: text("status").default("pending").notNull(),
		inviteSlot: integer("invite_slot"),
		claimId: text("claim_id"),
		claimedUsername: text("claimed_username"),
		claimedAt: timestamp("claimed_at", { withTimezone: true }),
		respondedBy: text("responded_by").references(() => user.id, { onDelete: "set null" }),
		respondedAt: timestamp("responded_at", { withTimezone: true }),
		expiresAt: timestamp("expires_at", { withTimezone: true })
			.default(sql`now() + interval '7 days'`)
			.notNull(),
		createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
	},
	(table) => [
		uniqueIndex("group_invite_token_uidx").on(table.token),
		uniqueIndex("group_invite_code_hash_uidx").on(table.codeHash),
		index("group_invite_creator_status_idx").on(table.createdBy, table.status, table.expiresAt),
		uniqueIndex("group_invite_creator_slot_uidx")
			.on(table.createdBy, table.inviteSlot)
			.where(
				sql`${table.inviteSlot} IS NOT NULL AND ${table.status} IN ('pending', 'provisioning', 'accepted')`,
			),
		uniqueIndex("group_invite_claimed_username_uidx")
			.on(table.claimedUsername)
			.where(sql`${table.status} = 'provisioning'`),
	],
);

export const taskReaction = pgTable(
	"task_reaction",
	{
		taskId: text("task_id")
			.notNull()
			.references(() => task.id, { onDelete: "cascade" }),
		senderId: text("sender_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		emoji: text("emoji").notNull(),
		createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
	},
	(table) => [uniqueIndex("task_reaction_pk").on(table.taskId, table.senderId)],
);

export const notification = pgTable(
	"notification",
	{
		id: text("id").primaryKey(),
		recipientId: text("recipient_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		senderId: text("sender_id").references(() => user.id, { onDelete: "set null" }),
		type: text("type").notNull(),
		metadata: jsonb("metadata").$type<Record<string, string>>().notNull(),
		readAt: timestamp("read_at", { withTimezone: true }),
		createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
	},
	(table) => [index("notification_recipient_created_idx").on(table.recipientId, table.createdAt)],
);

export const userSettings = pgTable("user_settings", {
	userId: text("user_id")
		.primaryKey()
		.references(() => user.id, { onDelete: "cascade" }),
	theme: text("theme").default("system").notNull(),
	notificationsEnabled: boolean("notifications_enabled").default(true).notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});
