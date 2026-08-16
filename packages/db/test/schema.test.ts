import { getTableName } from "drizzle-orm";
import { getTableConfig } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";

import {
  NOTIFICATION_STATUSES,
  NOTIFICATION_TYPES,
  ORGANIZATION_ROLES,
  PRODUCT_EVENT_TYPES,
  REPORT_SEVERITIES,
  REPORT_STATUSES,
  STATUS_EVENT_TYPES,
} from "@reproloop/shared";

import {
  attachments,
  bugReports,
  builds,
  discordGuilds,
  gameProjects,
  notificationStatus,
  notificationType,
  notifications,
  organizationMembers,
  organizationRole,
  organizations,
  productEvents,
  productEventType,
  reportSeverity,
  reportStatus,
  statusEvents,
  statusEventType,
  users,
} from "../src/index.js";

describe("database schema contract", () => {
  it("keeps PostgreSQL enum values aligned with @reproloop/shared", () => {
    expect(organizationRole.enumValues).toEqual([...ORGANIZATION_ROLES]);
    expect(reportStatus.enumValues).toEqual([...REPORT_STATUSES]);
    expect(reportSeverity.enumValues).toEqual([...REPORT_SEVERITIES]);
    expect(statusEventType.enumValues).toEqual([...STATUS_EVENT_TYPES]);
    expect(notificationType.enumValues).toEqual([...NOTIFICATION_TYPES]);
    expect(notificationStatus.enumValues).toEqual([...NOTIFICATION_STATUSES]);
    expect(productEventType.enumValues).toEqual([...PRODUCT_EVENT_TYPES]);
  });

  it("exports every MVP table using the approved physical name", () => {
    expect([
      users,
      organizations,
      organizationMembers,
      discordGuilds,
      gameProjects,
      builds,
      bugReports,
      attachments,
      statusEvents,
      notifications,
      productEvents,
    ].map(getTableName)).toEqual([
      "users",
      "organizations",
      "organization_members",
      "discord_guilds",
      "game_projects",
      "builds",
      "bug_reports",
      "attachments",
      "status_events",
      "notifications",
      "product_events",
    ]);
  });

  it("enforces report and notification idempotency with unique indexes", () => {
    const reportIndexNames = getTableConfig(bugReports).indexes.map((index) => index.config.name);
    const notificationIndexNames = getTableConfig(notifications).indexes.map(
      (index) => index.config.name,
    );

    expect(reportIndexNames).toContain("bug_reports_project_number_uidx");
    expect(reportIndexNames).toContain("bug_reports_discord_interaction_id_uidx");
    expect(notificationIndexNames).toContain("notifications_idempotency_key_uidx");
  });

  it("keeps optimistic locking and duplicate/fixed invariants in the report table", () => {
    const reportConfig = getTableConfig(bugReports);
    const checkNames = reportConfig.checks.map((check) => check.name);

    expect(bugReports.version.notNull).toBe(true);
    expect(bugReports.version.default).toBe(0);
    expect(checkNames).toEqual(
      expect.arrayContaining([
        "bug_reports_version_nonnegative",
        "bug_reports_duplicate_canonical_check",
        "bug_reports_fixed_build_check",
        "bug_reports_no_self_canonical_check",
      ]),
    );
  });
});
