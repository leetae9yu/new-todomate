ALTER TABLE "group_invite"
ALTER COLUMN "expires_at" SET DEFAULT (now() + interval '7 days');
