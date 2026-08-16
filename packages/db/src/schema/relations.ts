import { relations } from "drizzle-orm";

import { attachments } from "./attachments.js";
import { bugReports } from "./bug-reports.js";
import { builds } from "./builds.js";
import { discordGuilds } from "./discord-guilds.js";
import { gameProjects } from "./game-projects.js";
import { notifications } from "./notifications.js";
import { organizationMembers } from "./organization-members.js";
import { organizations } from "./organizations.js";
import { productEvents } from "./product-events.js";
import { statusEvents } from "./status-events.js";
import { users } from "./users.js";

export const usersRelations = relations(users, ({ many }) => ({
  memberships: many(organizationMembers),
  createdOrganizations: many(organizations),
  installedGuilds: many(discordGuilds),
  statusEvents: many(statusEvents),
  productEvents: many(productEvents),
}));

export const organizationsRelations = relations(organizations, ({ one, many }) => ({
  createdBy: one(users, {
    fields: [organizations.createdByUserId],
    references: [users.id],
  }),
  members: many(organizationMembers),
  guilds: many(discordGuilds),
  projects: many(gameProjects),
}));

export const organizationMembersRelations = relations(organizationMembers, ({ one }) => ({
  organization: one(organizations, {
    fields: [organizationMembers.organizationId],
    references: [organizations.id],
  }),
  user: one(users, {
    fields: [organizationMembers.userId],
    references: [users.id],
  }),
  verifiedViaGuild: one(discordGuilds, {
    fields: [organizationMembers.verifiedViaGuildId],
    references: [discordGuilds.id],
  }),
}));

export const discordGuildsRelations = relations(discordGuilds, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [discordGuilds.organizationId],
    references: [organizations.id],
  }),
  installedBy: one(users, {
    fields: [discordGuilds.installedByUserId],
    references: [users.id],
  }),
  projects: many(gameProjects),
  verifiedMembers: many(organizationMembers),
}));

export const gameProjectsRelations = relations(gameProjects, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [gameProjects.organizationId],
    references: [organizations.id],
  }),
  discordGuild: one(discordGuilds, {
    fields: [gameProjects.discordGuildId],
    references: [discordGuilds.id],
  }),
  builds: many(builds),
  reports: many(bugReports),
  productEvents: many(productEvents),
}));

export const buildsRelations = relations(builds, ({ one, many }) => ({
  project: one(gameProjects, {
    fields: [builds.projectId],
    references: [gameProjects.id],
  }),
  reports: many(bugReports, { relationName: "reportBuild" }),
  fixedReports: many(bugReports, { relationName: "fixedBuild" }),
}));

export const bugReportsRelations = relations(bugReports, ({ one, many }) => ({
  project: one(gameProjects, {
    fields: [bugReports.projectId],
    references: [gameProjects.id],
  }),
  build: one(builds, {
    fields: [bugReports.buildId],
    references: [builds.id],
    relationName: "reportBuild",
  }),
  fixedBuild: one(builds, {
    fields: [bugReports.fixedBuildId],
    references: [builds.id],
    relationName: "fixedBuild",
  }),
  canonicalReport: one(bugReports, {
    fields: [bugReports.canonicalReportId],
    references: [bugReports.id],
    relationName: "canonicalDuplicates",
  }),
  duplicates: many(bugReports, { relationName: "canonicalDuplicates" }),
  attachments: many(attachments),
  statusEvents: many(statusEvents),
  notifications: many(notifications),
  productEvents: many(productEvents),
}));

export const attachmentsRelations = relations(attachments, ({ one }) => ({
  report: one(bugReports, {
    fields: [attachments.reportId],
    references: [bugReports.id],
  }),
}));

export const statusEventsRelations = relations(statusEvents, ({ one, many }) => ({
  report: one(bugReports, {
    fields: [statusEvents.reportId],
    references: [bugReports.id],
  }),
  actor: one(users, {
    fields: [statusEvents.actorUserId],
    references: [users.id],
  }),
  notifications: many(notifications),
}));

export const notificationsRelations = relations(notifications, ({ one }) => ({
  report: one(bugReports, {
    fields: [notifications.reportId],
    references: [bugReports.id],
  }),
  statusEvent: one(statusEvents, {
    fields: [notifications.statusEventId],
    references: [statusEvents.id],
  }),
}));

export const productEventsRelations = relations(productEvents, ({ one }) => ({
  project: one(gameProjects, {
    fields: [productEvents.projectId],
    references: [gameProjects.id],
  }),
  report: one(bugReports, {
    fields: [productEvents.reportId],
    references: [bugReports.id],
  }),
  actor: one(users, {
    fields: [productEvents.actorUserId],
    references: [users.id],
  }),
}));
