ALTER TABLE "bug_reports" ADD COLUMN "bridge_receipt" text;--> statement-breakpoint
ALTER TABLE "discord_guilds" ADD COLUMN "bridge_installation_id" uuid;--> statement-breakpoint
ALTER TABLE "discord_guilds" ADD COLUMN "bridge_token" text;--> statement-breakpoint
ALTER TABLE "discord_guilds" ADD COLUMN "bridge_last_seen_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "dispatch_started_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "discord_message_id" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "local_username" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "password_hash" text;--> statement-breakpoint
CREATE UNIQUE INDEX "users_local_username_uidx" ON "users" USING btree ("local_username");