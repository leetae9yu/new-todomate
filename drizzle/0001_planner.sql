CREATE TABLE "category" (
	"id" text PRIMARY KEY,
	"owner_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
	"name" text NOT NULL,
	"color" text NOT NULL,
	"visibility" text NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "category_owner_id_idx" ON "category" ("owner_id");
--> statement-breakpoint
CREATE TABLE "task" (
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
--> statement-breakpoint
CREATE INDEX "task_owner_date_idx" ON "task" ("owner_id", "date");
--> statement-breakpoint
CREATE INDEX "task_owner_category_idx" ON "task" ("owner_id", "category_id");
--> statement-breakpoint
CREATE TABLE "routine" (
	"id" text PRIMARY KEY,
	"owner_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
	"category_id" text NOT NULL REFERENCES "category"("id") ON DELETE CASCADE,
	"title" text NOT NULL,
	"start_date" text NOT NULL,
	"end_date" text,
	"frequency_type" text NOT NULL,
	"frequency_days" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "routine_owner_date_idx" ON "routine" ("owner_id", "start_date");
--> statement-breakpoint
CREATE TABLE "routine_occurrence" (
	"routine_id" text NOT NULL REFERENCES "routine"("id") ON DELETE CASCADE,
	"owner_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
	"date" text NOT NULL,
	"completed" boolean DEFAULT false NOT NULL,
	"completed_at" timestamp with time zone,
	UNIQUE ("routine_id", "date")
);
--> statement-breakpoint
CREATE TABLE "diary" (
	"id" text PRIMARY KEY,
	"owner_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
	"date" text NOT NULL,
	"mood" text NOT NULL,
	"body" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	UNIQUE ("owner_id", "date")
);
