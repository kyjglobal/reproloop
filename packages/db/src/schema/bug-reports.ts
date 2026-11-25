import { sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  check,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { builds } from "./builds.js";
import { reportSeverity, reportStatus } from "./common.js";
import { gameProjects } from "./game-projects.js";

export const bugReports = pgTable(
  "bug_reports",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => gameProjects.id, { onDelete: "cascade" }),
    reportNumber: integer("report_number").notNull(),
    buildId: uuid("build_id")
      .notNull()
      .references(() => builds.id),
    title: text("title").notNull(),
    status: reportStatus("status").default("new").notNull(),
    severity: reportSeverity("severity").default("medium").notNull(),
    actualResult: text("actual_result").notNull(),
    expectedResult: text("expected_result").notNull(),
    reproductionSteps: text("reproduction_steps").notNull(),
    platform: text("platform").notNull(),
    environment: text("environment"),
    location: text("location"),
    frequency: text("frequency").notNull(),
    reporterDiscordUserId: text("reporter_discord_user_id").notNull(),
    reporterDisplayName: text("reporter_display_name").notNull(),
    discordGuildId: text("discord_guild_id").notNull(),
    sourceChannelId: text("source_channel_id").notNull(),
    discordInteractionId: text("discord_interaction_id").notNull(),
    bridgeReceipt: text("bridge_receipt"),
    canonicalReportId: uuid("canonical_report_id").references(
      (): AnyPgColumn => bugReports.id,
      { onDelete: "restrict" },
    ),
    fixedBuildId: uuid("fixed_build_id").references(() => builds.id),
    version: integer("version").default(0).notNull(),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("bug_reports_project_number_uidx").on(table.projectId, table.reportNumber),
    uniqueIndex("bug_reports_discord_interaction_id_uidx").on(table.discordInteractionId),
    index("bug_reports_project_status_created_at_idx").on(
      table.projectId,
      table.status,
      table.createdAt,
    ),
    index("bug_reports_project_build_idx").on(table.projectId, table.buildId),
    index("bug_reports_project_canonical_idx").on(table.projectId, table.canonicalReportId),
    index("bug_reports_reporter_created_at_idx").on(
      table.reporterDiscordUserId,
      table.createdAt,
    ),
    check("bug_reports_report_number_positive", sql`${table.reportNumber} > 0`),
    check("bug_reports_version_nonnegative", sql`${table.version} >= 0`),
    check(
      "bug_reports_duplicate_canonical_check",
      sql`${table.status} <> 'duplicate' OR ${table.canonicalReportId} IS NOT NULL`,
    ),
    check(
      "bug_reports_fixed_build_check",
      sql`${table.status} <> 'fixed' OR ${table.fixedBuildId} IS NOT NULL`,
    ),
    check(
      "bug_reports_no_self_canonical_check",
      sql`${table.canonicalReportId} IS NULL OR ${table.canonicalReportId} <> ${table.id}`,
    ),
  ],
);
