import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

export const reportStatus = pgEnum("report_status", [
  "new",
  "triaged",
  "in_progress",
  "fixed",
  "closed",
  "duplicate",
]);

export const organizations = pgTable("organizations", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const projects = pgTable("projects", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id),
  name: text("name").notNull(),
  discordGuildId: text("discord_guild_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const builds = pgTable("builds", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id),
  name: text("name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const reports = pgTable(
  "reports",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id),
    buildId: uuid("build_id").references(() => builds.id),
    discordUserId: text("discord_user_id").notNull(),
    title: text("title").notNull(),
    description: text("description").notNull(),
    stepsToReproduce: text("steps_to_reproduce"),
    expectedResult: text("expected_result"),
    actualResult: text("actual_result"),
    status: reportStatus("status").default("new").notNull(),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    projectStatusIdx: index("reports_project_status_idx").on(table.projectId, table.status),
    createdAtIdx: index("reports_created_at_idx").on(table.createdAt),
  }),
);

export const attachments = pgTable("attachments", {
  id: uuid("id").defaultRandom().primaryKey(),
  reportId: uuid("report_id")
    .notNull()
    .references(() => reports.id),
  storagePath: text("storage_path").notNull(),
  fileName: text("file_name").notNull(),
  mimeType: text("mime_type").notNull(),
  sizeBytes: integer("size_bytes").notNull(),
  sanitized: boolean("sanitized").default(false).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const statusEvents = pgTable("status_events", {
  id: uuid("id").defaultRandom().primaryKey(),
  reportId: uuid("report_id")
    .notNull()
    .references(() => reports.id),
  fromStatus: reportStatus("from_status"),
  toStatus: reportStatus("to_status").notNull(),
  actorDiscordUserId: text("actor_discord_user_id"),
  note: text("note"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});