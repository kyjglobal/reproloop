import { createBugReport, DrizzleReportRepository } from "@reproloop/db";
import { createDatabase, type Database, type DatabaseConnection } from "@reproloop/db/client";
import {
  bugReports,
  builds,
  discordGuilds,
  gameProjects,
  organizations,
  notifications,
  statusEvents,
  users,
} from "@reproloop/db/schema";
import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import type { AuthGuards } from "../src/server/auth/types";
import { transitionReportStatus } from "../src/server/reports/service";
import { dispatchReportTransition } from "../src/server/reports/transition-dispatcher";

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const describeWithDatabase = testDatabaseUrl ? describe : describe.skip;

describeWithDatabase("report transition database integration", () => {
  let connection: DatabaseConnection;
  let database: Database;
  let userId: string;
  let organizationId: string;
  let guildId: string;
  let projectId: string;
  let reportId: string;
  let buildId: string;
  let duplicateTargetId: string;
  let canonicalReportId: string;
  let relatedReportId: string;
  const suffix = crypto.randomUUID();

  beforeAll(async () => {
    connection = createDatabase(testDatabaseUrl!, { maxConnections: 1 });
    database = connection.database;

    const [user] = await database
      .insert(users)
      .values({ discordUserId: `transition-user-${suffix}`, displayName: "Transition Admin" })
      .returning({ id: users.id });
    userId = user!.id;

    const [organization] = await database
      .insert(organizations)
      .values({
        name: "Transition Test Organization",
        slug: `transition-org-${suffix}`,
        createdByUserId: userId,
      })
      .returning({ id: organizations.id });
    organizationId = organization!.id;

    const [guild] = await database
      .insert(discordGuilds)
      .values({
        organizationId,
        discordGuildId: `transition-guild-${suffix}`,
        name: "Transition Test Guild",
        installedByUserId: userId,
      })
      .returning({ id: discordGuilds.id });
    guildId = guild!.id;

    const [project] = await database
      .insert(gameProjects)
      .values({
        organizationId,
        discordGuildId: guildId,
        name: "Transition Test Game",
        slug: `transition-game-${suffix}`,
      })
      .returning({ id: gameProjects.id });
    projectId = project!.id;

    const [build] = await database
      .insert(builds)
      .values({ projectId, version: `transition-build-${suffix}` })
      .returning({ id: builds.id });
    buildId = build!.id;

    const created = await createBugReport(database, {
      projectId,
      buildId: build!.id,
      title: "Transition integration report",
      severity: "medium",
      actualResult: "The game freezes.",
      expectedResult: "The game stays responsive.",
      reproductionSteps: "Open the inventory.",
      platform: "Windows 11",
      frequency: "Always",
      reporterDiscordUserId: `transition-reporter-${suffix}`,
      reporterDisplayName: "Transition Reporter",
      discordGuildId: `transition-guild-${suffix}`,
      sourceChannelId: `transition-channel-${suffix}`,
      discordInteractionId: `transition-interaction-${suffix}`,
    });
    reportId = created.id;

    const duplicateTarget = await createBugReport(database, {
      projectId,
      buildId: build!.id,
      title: "Duplicate transition target",
      severity: "medium",
      actualResult: "The game freezes.",
      expectedResult: "The game stays responsive.",
      reproductionSteps: "Open the inventory twice.",
      platform: "Windows 11",
      frequency: "Always",
      reporterDiscordUserId: `duplicate-target-reporter-${suffix}`,
      reporterDisplayName: "Duplicate Target Reporter",
      discordGuildId: `transition-guild-${suffix}`,
      sourceChannelId: `transition-channel-${suffix}`,
      discordInteractionId: `duplicate-target-interaction-${suffix}`,
    });
    duplicateTargetId = duplicateTarget.id;

    const canonical = await createBugReport(database, {
      projectId,
      buildId: build!.id,
      title: "Canonical transition report",
      severity: "high",
      actualResult: "The game freezes.",
      expectedResult: "The game stays responsive.",
      reproductionSteps: "Open the inventory twice.",
      platform: "Windows 11",
      frequency: "Always",
      reporterDiscordUserId: `canonical-reporter-${suffix}`,
      reporterDisplayName: "Canonical Reporter",
      discordGuildId: `transition-guild-${suffix}`,
      sourceChannelId: `transition-channel-${suffix}`,
      discordInteractionId: `canonical-interaction-${suffix}`,
    });
    canonicalReportId = canonical.id;

    const related = await createBugReport(database, {
      projectId,
      buildId,
      title: "Related fixed notification report",
      severity: "medium",
      actualResult: "The game freezes.",
      expectedResult: "The game stays responsive.",
      reproductionSteps: "Open the inventory three times.",
      platform: "Windows 11",
      frequency: "Always",
      reporterDiscordUserId: `related-reporter-${suffix}`,
      reporterDisplayName: "Related Reporter",
      discordGuildId: `transition-guild-${suffix}`,
      sourceChannelId: `transition-channel-${suffix}`,
      discordInteractionId: `related-interaction-${suffix}`,
    });
    relatedReportId = related.id;
  });

  afterAll(async () => {
    if (!database || !connection) return;
    if (projectId) await database.delete(gameProjects).where(eq(gameProjects.id, projectId));
    if (guildId) await database.delete(discordGuilds).where(eq(discordGuilds.id, guildId));
    if (organizationId) {
      await database.delete(organizations).where(eq(organizations.id, organizationId));
    }
    if (userId) await database.delete(users).where(eq(users.id, userId));
    await connection.close();
  });

  it("commits the report update and event together", async () => {
    const guards = {
      requireProjectMember: vi.fn(async () => ({
        projectId,
        organizationId,
        userId,
        role: "member" as const,
      })),
    } as unknown as AuthGuards;

    await transitionReportStatus(
      { guards, reportRepository: new DrizzleReportRepository(database) },
      reportId,
      {
        action: "start_investigation",
        note: "통합 테스트 조사 시작",
        expectedVersion: 0,
      },
    );

    const [updated] = await database
      .select({ status: bugReports.status, version: bugReports.version })
      .from(bugReports)
      .where(eq(bugReports.id, reportId));
    const [event] = await database
      .select({
        eventType: statusEvents.eventType,
        fromStatus: statusEvents.fromStatus,
        toStatus: statusEvents.toStatus,
        note: statusEvents.note,
      })
      .from(statusEvents)
      .where(
        and(
          eq(statusEvents.reportId, reportId),
          eq(statusEvents.eventType, "investigation_started"),
        ),
      );

    expect(updated).toEqual({ status: "investigating", version: 1 });
    expect(event).toEqual({
      eventType: "investigation_started",
      fromStatus: "new",
      toStatus: "investigating",
      note: "통합 테스트 조사 시작",
    });
  });

  it("dispatches duplicate merge and unmerge through the shared transition boundary", async () => {
    const guards = {
      requireProjectMember: vi.fn(async () => ({
        projectId,
        organizationId,
        userId,
        role: "admin" as const,
      })),
    } as unknown as AuthGuards;
    const dependencies = {
      guards,
      reportRepository: new DrizzleReportRepository(database),
    };

    await dispatchReportTransition(dependencies, duplicateTargetId, {
      action: "merge_duplicate",
      canonicalReportId,
      expectedVersion: 0,
    });

    const [merged] = await database
      .select({
        status: bugReports.status,
        canonicalReportId: bugReports.canonicalReportId,
        version: bugReports.version,
      })
      .from(bugReports)
      .where(eq(bugReports.id, duplicateTargetId));
    expect(merged).toEqual({
      status: "duplicate",
      canonicalReportId,
      version: 1,
    });

    await dispatchReportTransition(dependencies, duplicateTargetId, {
      action: "unmerge_duplicate",
      expectedVersion: 1,
    });

    const [restored] = await database
      .select({
        status: bugReports.status,
        canonicalReportId: bugReports.canonicalReportId,
        version: bugReports.version,
      })
      .from(bugReports)
      .where(eq(bugReports.id, duplicateTargetId));
    const duplicateEvents = await database
      .select({ eventType: statusEvents.eventType, metadata: statusEvents.metadata })
      .from(statusEvents)
      .where(
        and(
          eq(statusEvents.reportId, duplicateTargetId),
          eq(statusEvents.eventType, "duplicate_merged"),
        ),
      );

    expect(restored).toEqual({ status: "new", canonicalReportId: null, version: 2 });
    expect(duplicateEvents).toContainEqual({
      eventType: "duplicate_merged",
      metadata: { previousStatus: "new", canonicalReportId },
    });
  });

  it("commits fixed status, notifications, and queue jobs together", async () => {
    const guards = {
      requireProjectMember: vi.fn(async () => ({
        projectId,
        organizationId,
        userId,
        role: "admin" as const,
      })),
    } as unknown as AuthGuards;
    const enqueuedNotificationIds: string[] = [];
    const repository = new DrizzleReportRepository(database, async (_transaction, job) => {
      enqueuedNotificationIds.push(job.notificationId);
    });
    const dependencies = { guards, reportRepository: repository };

    await dispatchReportTransition(dependencies, relatedReportId, {
      action: "merge_duplicate",
      canonicalReportId,
      expectedVersion: 0,
    });
    await dispatchReportTransition(dependencies, canonicalReportId, {
      action: "mark_reproduced",
      expectedVersion: 0,
    });
    await dispatchReportTransition(dependencies, canonicalReportId, {
      action: "mark_fixed",
      fixedBuildId: buildId,
      note: "통합 테스트 수정 완료",
      expectedVersion: 1,
    });

    const [fixedReport] = await database
      .select({
        status: bugReports.status,
        fixedBuildId: bugReports.fixedBuildId,
        resolvedAt: bugReports.resolvedAt,
        version: bugReports.version,
      })
      .from(bugReports)
      .where(eq(bugReports.id, canonicalReportId));
    const createdNotifications = await database
      .select({
        id: notifications.id,
        recipientDiscordUserId: notifications.recipientDiscordUserId,
        status: notifications.status,
        type: notifications.type,
      })
      .from(notifications)
      .where(eq(notifications.reportId, canonicalReportId));

    expect(fixedReport).toMatchObject({
      status: "fixed",
      fixedBuildId: buildId,
      version: 2,
    });
    expect(fixedReport?.resolvedAt).toBeInstanceOf(Date);
    expect(createdNotifications).toHaveLength(2);
    expect(createdNotifications.map((item) => item.recipientDiscordUserId).sort()).toEqual(
      [`canonical-reporter-${suffix}`, `related-reporter-${suffix}`].sort(),
    );
    expect(createdNotifications.every((item) => item.status === "queued")).toBe(true);
    expect(createdNotifications.every((item) => item.type === "report_fixed")).toBe(true);
    expect(enqueuedNotificationIds.sort()).toEqual(
      createdNotifications.map((item) => item.id).sort(),
    );
  });
});
