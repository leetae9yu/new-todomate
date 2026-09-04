ALTER TABLE "group_invite" ADD COLUMN IF NOT EXISTS "expires_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "group_invite" ADD COLUMN IF NOT EXISTS "invite_slot" integer;
--> statement-breakpoint
ALTER TABLE "group_invite" ADD COLUMN IF NOT EXISTS "code_hash" text;
--> statement-breakpoint
ALTER TABLE "group_invite" ADD COLUMN IF NOT EXISTS "claim_id" text;
--> statement-breakpoint
ALTER TABLE "group_invite" ADD COLUMN IF NOT EXISTS "claimed_username" text;
--> statement-breakpoint
ALTER TABLE "group_invite" ADD COLUMN IF NOT EXISTS "claimed_at" timestamp with time zone;
--> statement-breakpoint
UPDATE "group_invite"
SET "expires_at" = "created_at" + interval '7 days'
WHERE "expires_at" IS NULL;
--> statement-breakpoint
UPDATE "group_invite"
SET "status" = 'expired'
WHERE "status" = 'pending' AND "invite_slot" IS NULL;
--> statement-breakpoint
ALTER TABLE "group_invite" ALTER COLUMN "expires_at" SET NOT NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "group_invite_creator_status_idx"
ON "group_invite" ("created_by", "status", "expires_at");
--> statement-breakpoint
DROP INDEX IF EXISTS "group_invite_creator_slot_uidx";
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "group_invite_creator_slot_uidx"
ON "group_invite" ("created_by", "invite_slot")
WHERE "invite_slot" IS NOT NULL AND "status" IN ('pending', 'provisioning', 'accepted');
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "group_invite_code_hash_uidx"
ON "group_invite" ("code_hash")
WHERE "code_hash" IS NOT NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "group_invite_claimed_username_uidx"
ON "group_invite" ("claimed_username")
WHERE "status" = 'provisioning';
--> statement-breakpoint
ALTER TABLE "group_invite" DROP CONSTRAINT IF EXISTS "group_invite_slot_check";
--> statement-breakpoint
ALTER TABLE "group_invite"
ADD CONSTRAINT "group_invite_slot_check"
CHECK ("invite_slot" IS NULL OR "invite_slot" BETWEEN 1 AND 3);
--> statement-breakpoint
ALTER TABLE "group_invite" DROP CONSTRAINT IF EXISTS "group_invite_status_check";
--> statement-breakpoint
ALTER TABLE "group_invite"
ADD CONSTRAINT "group_invite_status_check"
CHECK ("status" IN ('pending', 'provisioning', 'accepted', 'rejected', 'expired', 'revoked'));
