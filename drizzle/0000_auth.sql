CREATE TABLE "user" (
	"id" text PRIMARY KEY,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"username" text,
	"display_username" text,
	"status" text DEFAULT 'active' NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "user_email_uidx" ON "user" ("email");
--> statement-breakpoint
CREATE UNIQUE INDEX "user_username_uidx" ON "user" ("username");
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY,
	"expires_at" timestamp with time zone NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE
);
--> statement-breakpoint
CREATE UNIQUE INDEX "session_token_uidx" ON "session" ("token");
--> statement-breakpoint
CREATE INDEX "session_user_id_idx" ON "session" ("user_id");
--> statement-breakpoint
CREATE TABLE "account" (
	"id" text PRIMARY KEY,
	"issuer" text NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"password" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "account_issuer_account_id_uidx"
	ON "account" ("issuer", "account_id");
--> statement-breakpoint
CREATE INDEX "account_user_id_idx" ON "account" ("user_id");
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "verification_identifier_idx" ON "verification" ("identifier");
