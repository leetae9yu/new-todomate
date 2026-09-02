export const PLANNER_MIGRATION_SQL = `
CREATE TABLE IF NOT EXISTS "category" (
	"id" text PRIMARY KEY,
	"owner_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
	"name" text NOT NULL,
	"color" text NOT NULL,
	"visibility" text NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "category_owner_id_idx" ON "category" ("owner_id");

CREATE TABLE IF NOT EXISTS "task" (
	"id" text PRIMARY KEY,
	"owner_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
	"category_id" text NOT NULL REFERENCES "category"("id") ON DELETE CASCADE,
	"title" text NOT NULL,
	"date" text,
	"position" integer DEFAULT 0 NOT NULL,
	"completed" boolean DEFAULT false NOT NULL,
	"completed_at" timestamp with time zone,
	"timer_started_at" timestamp with time zone,
	"timer_elapsed_seconds" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "task_owner_date_idx" ON "task" ("owner_id", "date");
CREATE INDEX IF NOT EXISTS "task_owner_category_idx" ON "task" ("owner_id", "category_id");

CREATE TABLE IF NOT EXISTS "routine" (
	"id" text PRIMARY KEY,
	"owner_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
	"category_id" text NOT NULL REFERENCES "category"("id") ON DELETE CASCADE,
	"title" text NOT NULL,
	"start_date" text NOT NULL,
	"end_date" text,
	"frequency_type" text NOT NULL,
	"frequency_days" jsonb NOT NULL,
	"status" text DEFAULT 'active' NOT NULL CHECK ("status" IN ('active', 'paused')),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
ALTER TABLE "routine" ADD COLUMN IF NOT EXISTS "status" text DEFAULT 'active' NOT NULL CHECK ("status" IN ('active', 'paused'));
CREATE INDEX IF NOT EXISTS "routine_owner_date_idx" ON "routine" ("owner_id", "start_date");

CREATE TABLE IF NOT EXISTS "routine_occurrence" (
	"routine_id" text NOT NULL REFERENCES "routine"("id") ON DELETE CASCADE,
	"owner_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
	"date" text NOT NULL,
	"completed" boolean DEFAULT false NOT NULL,
	"completed_at" timestamp with time zone,
	UNIQUE ("routine_id", "date")
);

CREATE TABLE IF NOT EXISTS "diary" (
	"id" text PRIMARY KEY,
	"owner_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
	"date" text NOT NULL,
	"mood" text NOT NULL,
	"body" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	UNIQUE ("owner_id", "date")
);
`;
