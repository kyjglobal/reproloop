import { createBugReport, DrizzleReportRepository } from "@reproloop/db";
import { createDatabase, type Database, type DatabaseConnection } from "@reproloop/db/client";
import {
  bugReports,
  builds,
  discordGuilds,
  gameProjects,
  organizations,
  statusEvents,
  users,
} from "@reproloop/db/schema";
import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import type { AuthGuards } from "../src/server/auth/types";
import { transitionReportStatus } from "../src/server/reports/service";

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
});
