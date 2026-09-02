export const SOCIAL_MIGRATION_SQL = `
CREATE TABLE IF NOT EXISTS "social_group" (
	"id" text PRIMARY KEY,
	"name" text NOT NULL,
	"owner_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "social_group_owner_id_idx" ON "social_group" ("owner_id");

CREATE TABLE IF NOT EXISTS "group_membership" (
	"group_id" text NOT NULL REFERENCES "social_group"("id") ON DELETE CASCADE,
	"user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
	"role" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	PRIMARY KEY ("group_id", "user_id")
);
CREATE INDEX IF NOT EXISTS "group_membership_user_id_idx" ON "group_membership" ("user_id");

CREATE TABLE IF NOT EXISTS "group_invite" (
	"id" text PRIMARY KEY,
	"group_id" text NOT NULL REFERENCES "social_group"("id") ON DELETE CASCADE,
	"created_by" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
	"token" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"responded_by" text REFERENCES "user"("id") ON DELETE SET NULL,
	"responded_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "group_invite_token_uidx" ON "group_invite" ("token");

ALTER TABLE "category" ADD COLUMN IF NOT EXISTS "group_id" text REFERENCES "social_group"("id") ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS "category_group_id_idx" ON "category" ("group_id");

CREATE TABLE IF NOT EXISTS "task_reaction" (
	"task_id" text NOT NULL REFERENCES "task"("id") ON DELETE CASCADE,
	"sender_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
	"emoji" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	PRIMARY KEY ("task_id", "sender_id")
);

CREATE TABLE IF NOT EXISTS "notification" (
	"id" text PRIMARY KEY,
	"recipient_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
	"sender_id" text REFERENCES "user"("id") ON DELETE SET NULL,
	"type" text NOT NULL,
	"metadata" jsonb NOT NULL,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "notification_recipient_created_idx" ON "notification" ("recipient_id", "created_at");

CREATE TABLE IF NOT EXISTS "user_settings" (
	"user_id" text PRIMARY KEY REFERENCES "user"("id") ON DELETE CASCADE,
	"theme" text DEFAULT 'system' NOT NULL,
	"notifications_enabled" boolean DEFAULT true NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
`;
