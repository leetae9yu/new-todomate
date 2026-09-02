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
import { user } from "./auth";

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
		status: text("status").default("active").notNull(),
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
