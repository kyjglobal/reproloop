-- The bootstrap schema was applied before the MVP contract was finalized.
-- It has no data in the shared development database. Refuse to rebuild it if
-- another environment has started using any bootstrap table.
DO $$
BEGIN
	IF EXISTS (SELECT 1 FROM "organizations" LIMIT 1)
		OR EXISTS (SELECT 1 FROM "projects" LIMIT 1)
		OR EXISTS (SELECT 1 FROM "builds" LIMIT 1)
		OR EXISTS (SELECT 1 FROM "reports" LIMIT 1)
		OR EXISTS (SELECT 1 FROM "attachments" LIMIT 1)
		OR EXISTS (SELECT 1 FROM "status_events" LIMIT 1)
	THEN
		RAISE EXCEPTION '0001_full_schema_alignment requires empty bootstrap tables';
	END IF;
END $$;--> statement-breakpoint
DROP TABLE "attachments", "status_events", "reports", "builds", "projects", "organizations" CASCADE;--> statement-breakpoint
DROP TYPE "public"."report_status";--> statement-breakpoint
CREATE TYPE "public"."notification_status" AS ENUM('queued', 'processing', 'sent', 'failed');--> statement-breakpoint
CREATE TYPE "public"."notification_type" AS ENUM('information_requested', 'report_fixed');--> statement-breakpoint
CREATE TYPE "public"."organization_role" AS ENUM('owner', 'admin', 'member');--> statement-breakpoint
CREATE TYPE "public"."product_event_type" AS ENUM('bug_command_started', 'bug_report_submitted', 'report_viewed', 'report_status_changed', 'duplicate_merged', 'fix_notification_sent');--> statement-breakpoint
CREATE TYPE "public"."report_severity" AS ENUM('low', 'medium', 'high', 'critical');--> statement-breakpoint
CREATE TYPE "public"."report_status" AS ENUM('new', 'needs_info', 'investigating', 'reproduced', 'fixed', 'duplicate');--> statement-breakpoint
CREATE TYPE "public"."status_event_type" AS ENUM('report_created', 'information_requested', 'investigation_started', 'report_reproduced', 'duplicate_merged', 'duplicate_unmerged', 'report_fixed');--> statement-breakpoint
CREATE TABLE "attachments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"report_id" uuid NOT NULL,
	"storage_path" text NOT NULL,
	"original_filename" text NOT NULL,
	"content_type" text NOT NULL,
	"size_bytes" bigint NOT NULL,
	"sha256" text NOT NULL,
	"sanitization_version" text,
	"sanitized_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bug_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"report_number" integer NOT NULL,
	"build_id" uuid NOT NULL,
	"title" text NOT NULL,
	"status" "report_status" DEFAULT 'new' NOT NULL,
	"severity" "report_severity" DEFAULT 'medium' NOT NULL,
	"actual_result" text NOT NULL,
	"expected_result" text NOT NULL,
	"reproduction_steps" text NOT NULL,
	"platform" text NOT NULL,
	"environment" text,
	"location" text,
	"frequency" text NOT NULL,
	"reporter_discord_user_id" text NOT NULL,
	"reporter_display_name" text NOT NULL,
	"discord_guild_id" text NOT NULL,
	"source_channel_id" text NOT NULL,
	"discord_interaction_id" text NOT NULL,
	"canonical_report_id" uuid,
	"fixed_build_id" uuid,
	"version" integer DEFAULT 0 NOT NULL,
	"resolved_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bug_reports_report_number_positive" CHECK ("bug_reports"."report_number" > 0),
	CONSTRAINT "bug_reports_version_nonnegative" CHECK ("bug_reports"."version" >= 0),
	CONSTRAINT "bug_reports_duplicate_canonical_check" CHECK ("bug_reports"."status" <> 'duplicate' OR "bug_reports"."canonical_report_id" IS NOT NULL),
	CONSTRAINT "bug_reports_fixed_build_check" CHECK ("bug_reports"."status" <> 'fixed' OR "bug_reports"."fixed_build_id" IS NOT NULL),
	CONSTRAINT "bug_reports_no_self_canonical_check" CHECK ("bug_reports"."canonical_report_id" IS NULL OR "bug_reports"."canonical_report_id" <> "bug_reports"."id")
);
--> statement-breakpoint
CREATE TABLE "builds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"version" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"released_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "discord_guilds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"discord_guild_id" text NOT NULL,
	"name" text NOT NULL,
	"bug_channel_id" text,
	"installed_by_user_id" uuid,
	"installed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"removed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "game_projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"discord_guild_id" uuid NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"default_locale" text DEFAULT 'ko' NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"report_id" uuid NOT NULL,
	"status_event_id" uuid NOT NULL,
	"recipient_discord_user_id" text NOT NULL,
	"type" "notification_type" NOT NULL,
	"status" "notification_status" DEFAULT 'queued' NOT NULL,
	"idempotency_key" text NOT NULL,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"last_error_code" text,
	"last_error_message" text,
	"sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organization_members" (
	"organization_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" "organization_role" NOT NULL,
	"verified_via_guild_id" uuid,
	"verified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "organization_members_organization_id_user_id_pk" PRIMARY KEY("organization_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"created_by_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_type" "product_event_type" NOT NULL,
	"project_id" uuid,
	"report_id" uuid,
	"actor_user_id" uuid,
	"properties" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "status_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"report_id" uuid NOT NULL,
	"event_type" "status_event_type" NOT NULL,
	"from_status" "report_status",
	"to_status" "report_status" NOT NULL,
	"actor_user_id" uuid,
	"note" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"discord_user_id" text NOT NULL,
	"email" text,
	"display_name" text NOT NULL,
	"avatar_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_report_id_bug_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."bug_reports"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bug_reports" ADD CONSTRAINT "bug_reports_project_id_game_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."game_projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bug_reports" ADD CONSTRAINT "bug_reports_build_id_builds_id_fk" FOREIGN KEY ("build_id") REFERENCES "public"."builds"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bug_reports" ADD CONSTRAINT "bug_reports_canonical_report_id_bug_reports_id_fk" FOREIGN KEY ("canonical_report_id") REFERENCES "public"."bug_reports"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bug_reports" ADD CONSTRAINT "bug_reports_fixed_build_id_builds_id_fk" FOREIGN KEY ("fixed_build_id") REFERENCES "public"."builds"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "builds" ADD CONSTRAINT "builds_project_id_game_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."game_projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discord_guilds" ADD CONSTRAINT "discord_guilds_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discord_guilds" ADD CONSTRAINT "discord_guilds_installed_by_user_id_users_id_fk" FOREIGN KEY ("installed_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_projects" ADD CONSTRAINT "game_projects_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_projects" ADD CONSTRAINT "game_projects_discord_guild_id_discord_guilds_id_fk" FOREIGN KEY ("discord_guild_id") REFERENCES "public"."discord_guilds"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_report_id_bug_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."bug_reports"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_status_event_id_status_events_id_fk" FOREIGN KEY ("status_event_id") REFERENCES "public"."status_events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_verified_via_guild_id_discord_guilds_id_fk" FOREIGN KEY ("verified_via_guild_id") REFERENCES "public"."discord_guilds"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_events" ADD CONSTRAINT "product_events_project_id_game_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."game_projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_events" ADD CONSTRAINT "product_events_report_id_bug_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."bug_reports"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_events" ADD CONSTRAINT "product_events_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "status_events" ADD CONSTRAINT "status_events_report_id_bug_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."bug_reports"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "status_events" ADD CONSTRAINT "status_events_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "attachments_storage_path_uidx" ON "attachments" USING btree ("storage_path");--> statement-breakpoint
CREATE INDEX "attachments_report_id_idx" ON "attachments" USING btree ("report_id");--> statement-breakpoint
CREATE INDEX "attachments_expires_at_idx" ON "attachments" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "bug_reports_project_number_uidx" ON "bug_reports" USING btree ("project_id","report_number");--> statement-breakpoint
CREATE UNIQUE INDEX "bug_reports_discord_interaction_id_uidx" ON "bug_reports" USING btree ("discord_interaction_id");--> statement-breakpoint
CREATE INDEX "bug_reports_project_status_created_at_idx" ON "bug_reports" USING btree ("project_id","status","created_at");--> statement-breakpoint
CREATE INDEX "bug_reports_project_build_idx" ON "bug_reports" USING btree ("project_id","build_id");--> statement-breakpoint
CREATE INDEX "bug_reports_project_canonical_idx" ON "bug_reports" USING btree ("project_id","canonical_report_id");--> statement-breakpoint
CREATE INDEX "bug_reports_reporter_created_at_idx" ON "bug_reports" USING btree ("reporter_discord_user_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "builds_project_version_uidx" ON "builds" USING btree ("project_id","version");--> statement-breakpoint
CREATE INDEX "builds_project_active_idx" ON "builds" USING btree ("project_id","is_active");--> statement-breakpoint
CREATE UNIQUE INDEX "discord_guilds_discord_guild_id_uidx" ON "discord_guilds" USING btree ("discord_guild_id");--> statement-breakpoint
CREATE UNIQUE INDEX "game_projects_organization_slug_uidx" ON "game_projects" USING btree ("organization_id","slug");--> statement-breakpoint
CREATE INDEX "game_projects_discord_guild_id_idx" ON "game_projects" USING btree ("discord_guild_id");--> statement-breakpoint
CREATE UNIQUE INDEX "notifications_idempotency_key_uidx" ON "notifications" USING btree ("idempotency_key");--> statement-breakpoint
CREATE INDEX "notifications_status_created_at_idx" ON "notifications" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "notifications_report_id_idx" ON "notifications" USING btree ("report_id");--> statement-breakpoint
CREATE UNIQUE INDEX "organizations_slug_uidx" ON "organizations" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "product_events_type_created_at_idx" ON "product_events" USING btree ("event_type","created_at");--> statement-breakpoint
CREATE INDEX "product_events_project_created_at_idx" ON "product_events" USING btree ("project_id","created_at");--> statement-breakpoint
CREATE INDEX "status_events_report_created_at_idx" ON "status_events" USING btree ("report_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "users_discord_user_id_uidx" ON "users" USING btree ("discord_user_id");
