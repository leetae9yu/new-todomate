import {
	boolean,
	index,
	integer,
	jsonb,
	pgTable,
	text,
	timestamp,
	uniqueIndex,
	uuid,
} from "drizzle-orm/pg-core";

export const user = pgTable(
	"user",
	{
		id: text("id").primaryKey(),
		name: text("name").notNull(),
		email: text("email").notNull(),
		emailVerified: boolean("email_verified").default(false).notNull(),
		image: text("image"),
		createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
		username: text("username"),
		displayUsername: text("display_username"),
		status: text("status").default("active").notNull(),
	},
	(table) => [
		uniqueIndex("user_email_uidx").on(table.email),
		uniqueIndex("user_username_uidx").on(table.username),
	],
);

export const session = pgTable(
	"session",
	{
		id: text("id").primaryKey(),
		expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
		token: text("token").notNull(),
		createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
		ipAddress: text("ip_address"),
		userAgent: text("user_agent"),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
	},
	(table) => [
		uniqueIndex("session_token_uidx").on(table.token),
		index("session_user_id_idx").on(table.userId),
	],
);

export const account = pgTable(
	"account",
	{
		id: text("id").primaryKey(),
		issuer: text("issuer").notNull(),
		accountId: text("account_id").notNull(),
		providerId: text("provider_id").notNull(),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		accessToken: text("access_token"),
		refreshToken: text("refresh_token"),
		idToken: text("id_token"),
		accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
		refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
		scope: text("scope"),
		password: text("password"),
		createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
	},
	(table) => [
		uniqueIndex("account_issuer_account_id_uidx").on(table.issuer, table.accountId),
		index("account_user_id_idx").on(table.userId),
	],
);

export const verification = pgTable(
	"verification",
	{
		id: text("id").primaryKey(),
		identifier: text("identifier").notNull(),
		value: text("value").notNull(),
		expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
		createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
	},
	(table) => [index("verification_identifier_idx").on(table.identifier)],
);

export const schemaVersion = pgTable("schema_version", {
	id: uuid("id").defaultRandom().primaryKey(),
	version: text("version").notNull(),
	appliedAt: timestamp("applied_at", { withTimezone: true }).defaultNow().notNull(),
});

export const category = pgTable(
	"category",
	{
		id: text("id").primaryKey(),
		ownerId: text("owner_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		name: text("name").notNull(),
		color: text("color").notNull(),
		visibility: text("visibility").notNull(),
		position: integer("position").default(0).notNull(),
		groupId: text("group_id"),
		createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
	},
	(table) => [index("category_owner_id_idx").on(table.ownerId)],
);

export const task = pgTable(
	"task",
	{
		id: text("id").primaryKey(),
		ownerId: text("owner_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		categoryId: text("category_id")
			.notNull()
			.references(() => category.id, { onDelete: "cascade" }),
		title: text("title").notNull(),
		date: text("date"),
		position: integer("position").default(0).notNull(),
		completed: boolean("completed").default(false).notNull(),
		completedAt: timestamp("completed_at", { withTimezone: true }),
		timerStartedAt: timestamp("timer_started_at", { withTimezone: true }),
		timerElapsedSeconds: integer("timer_elapsed_seconds").default(0).notNull(),
		createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
	},
	(table) => [
		index("task_owner_date_idx").on(table.ownerId, table.date),
		index("task_owner_category_idx").on(table.ownerId, table.categoryId),
	],
);

export const routine = pgTable(
	"routine",
	{
		id: text("id").primaryKey(),
		ownerId: text("owner_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		categoryId: text("category_id")
			.notNull()
			.references(() => category.id, { onDelete: "cascade" }),
		title: text("title").notNull(),
		startDate: text("start_date").notNull(),
		endDate: text("end_date"),
		frequencyType: text("frequency_type").notNull(),
		frequencyDays: jsonb("frequency_days").$type<number[]>().notNull(),
		createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
	},
	(table) => [index("routine_owner_date_idx").on(table.ownerId, table.startDate)],
);

export const routineOccurrence = pgTable(
	"routine_occurrence",
	{
		routineId: text("routine_id")
			.notNull()
			.references(() => routine.id, { onDelete: "cascade" }),
		ownerId: text("owner_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		date: text("date").notNull(),
		completed: boolean("completed").default(false).notNull(),
		completedAt: timestamp("completed_at", { withTimezone: true }),
	},
	(table) => [uniqueIndex("routine_occurrence_uidx").on(table.routineId, table.date)],
);

export const diary = pgTable(
	"diary",
	{
		id: text("id").primaryKey(),
		ownerId: text("owner_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		date: text("date").notNull(),
		mood: text("mood").notNull(),
		body: text("body").notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
	},
	(table) => [uniqueIndex("diary_owner_date_uidx").on(table.ownerId, table.date)],
);

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
		status: text("status").default("pending").notNull(),
		respondedBy: text("responded_by").references(() => user.id, { onDelete: "set null" }),
		respondedAt: timestamp("responded_at", { withTimezone: true }),
		createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
	},
	(table) => [uniqueIndex("group_invite_token_uidx").on(table.token)],
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

export const authSchema = {
	user,
	session,
	account,
	verification,
};
