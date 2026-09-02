export const CHAT_MIGRATION_SQL = `
CREATE TABLE IF NOT EXISTS "chat_room" (
	"id" text PRIMARY KEY,
	"kind" text NOT NULL CHECK ("kind" IN ('group', 'dm')),
	"group_id" text REFERENCES "social_group"("id") ON DELETE CASCADE,
	"direct_key" text,
	"next_sequence" bigint NOT NULL DEFAULT 0 CHECK ("next_sequence" >= 0),
	"last_message_at" timestamp with time zone,
	"created_at" timestamp with time zone NOT NULL DEFAULT now(),
	CONSTRAINT "chat_room_shape_check" CHECK (
		("kind" = 'group' AND "group_id" IS NOT NULL AND "direct_key" IS NULL) OR
		("kind" = 'dm' AND "group_id" IS NULL AND "direct_key" IS NOT NULL)
	),
	CONSTRAINT "chat_room_group_id_uidx" UNIQUE ("group_id"),
	CONSTRAINT "chat_room_direct_key_uidx" UNIQUE ("direct_key")
);

CREATE TABLE IF NOT EXISTS "chat_room_member" (
	"room_id" text NOT NULL REFERENCES "chat_room"("id") ON DELETE CASCADE,
	"user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
	"joined_sequence" bigint NOT NULL DEFAULT 0 CHECK ("joined_sequence" >= 0),
	"last_read_sequence" bigint NOT NULL DEFAULT 0 CHECK ("last_read_sequence" >= 0),
	"last_read_at" timestamp with time zone,
	"created_at" timestamp with time zone NOT NULL DEFAULT now(),
	PRIMARY KEY ("room_id", "user_id"),
	CONSTRAINT "chat_room_member_cursor_check" CHECK ("last_read_sequence" >= "joined_sequence")
);
CREATE INDEX IF NOT EXISTS "chat_room_member_user_id_idx" ON "chat_room_member" ("user_id");

CREATE TABLE IF NOT EXISTS "chat_message" (
	"id" text PRIMARY KEY,
	"room_id" text NOT NULL REFERENCES "chat_room"("id") ON DELETE CASCADE,
	"sender_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
	"sequence" bigint NOT NULL CHECK ("sequence" > 0),
	"client_message_id" text NOT NULL,
	"body" text NOT NULL CHECK (char_length(btrim("body")) BETWEEN 1 AND 4000),
	"created_at" timestamp with time zone NOT NULL DEFAULT now(),
	CONSTRAINT "chat_message_room_sequence_uidx" UNIQUE ("room_id", "sequence"),
	CONSTRAINT "chat_message_sender_client_message_uidx" UNIQUE ("sender_id", "client_message_id")
);
CREATE INDEX IF NOT EXISTS "chat_message_room_sequence_idx" ON "chat_message" ("room_id", "sequence");

CREATE OR REPLACE FUNCTION "chat_group_room_after_insert"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
	INSERT INTO "chat_room" ("id", "kind", "group_id")
	VALUES ('group:' || NEW."id", 'group', NEW."id")
	ON CONFLICT ("group_id") DO NOTHING;
	RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION "chat_group_member_after_insert"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
	INSERT INTO "chat_room" ("id", "kind", "group_id")
	VALUES ('group:' || NEW."group_id", 'group', NEW."group_id")
	ON CONFLICT ("group_id") DO NOTHING;

	INSERT INTO "chat_room_member" ("room_id", "user_id", "joined_sequence", "last_read_sequence")
	SELECT "id", NEW."user_id", "next_sequence", "next_sequence"
	FROM "chat_room"
	WHERE "group_id" = NEW."group_id"
	ON CONFLICT DO NOTHING;
	RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION "chat_group_member_after_delete"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
	DELETE FROM "chat_room_member"
	USING "chat_room"
	WHERE "chat_room_member"."room_id" = "chat_room"."id"
		AND "chat_room"."group_id" = OLD."group_id"
		AND "chat_room_member"."user_id" = OLD."user_id";
	RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS "social_group_chat_room_ai" ON "social_group";
CREATE TRIGGER "social_group_chat_room_ai"
AFTER INSERT ON "social_group"
FOR EACH ROW EXECUTE FUNCTION "chat_group_room_after_insert"();

DROP TRIGGER IF EXISTS "group_membership_chat_member_ai" ON "group_membership";
CREATE TRIGGER "group_membership_chat_member_ai"
AFTER INSERT ON "group_membership"
FOR EACH ROW EXECUTE FUNCTION "chat_group_member_after_insert"();

DROP TRIGGER IF EXISTS "group_membership_chat_member_ad" ON "group_membership";
CREATE TRIGGER "group_membership_chat_member_ad"
AFTER DELETE ON "group_membership"
FOR EACH ROW EXECUTE FUNCTION "chat_group_member_after_delete"();

INSERT INTO "chat_room" ("id", "kind", "group_id")
SELECT 'group:' || "id", 'group', "id"
FROM "social_group"
ON CONFLICT ("group_id") DO NOTHING;

INSERT INTO "chat_room_member" ("room_id", "user_id", "joined_sequence", "last_read_sequence")
SELECT "chat_room"."id", "group_membership"."user_id", 0, 0
FROM "group_membership"
JOIN "chat_room" ON "chat_room"."group_id" = "group_membership"."group_id"
ON CONFLICT DO NOTHING;
`;
