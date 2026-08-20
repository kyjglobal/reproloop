import { createBugReport } from "@reproloop/db";
import { createDatabase, type Database, type DatabaseConnection } from "@reproloop/db/client";
import {
  attachments,
  bugReports,
  builds,
  discordGuilds,
  gameProjects,
  organizations,
  statusEvents,
  users,
} from "@reproloop/db/schema";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { DrizzleReportDetailQueryRepository } from "../src/server/reports/drizzle-report-detail-query-repository";

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const describeWithDatabase = testDatabaseUrl ? describe : describe.skip;

describeWithDatabase("report detail database integration", () => {
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
      .values({ discordUserId: `detail-user-${suffix}`, displayName: "Detail Admin" })
      .returning({ id: users.id });
    userId = user!.id;

    const [organization] = await database
      .insert(organizations)
      .values({
        name: "Detail Test Organization",
        slug: `detail-org-${suffix}`,
        createdByUserId: userId,
      })
      .returning({ id: organizations.id });
    organizationId = organization!.id;

    const [guild] = await database
      .insert(discordGuilds)
      .values({
        organizationId,
        discordGuildId: `detail-guild-${suffix}`,
        name: "Detail Test Guild",
        installedByUserId: userId,
      })
      .returning({ id: discordGuilds.id });
    guildId = guild!.id;

    const [project] = await database
      .insert(gameProjects)
      .values({
        organizationId,
        discordGuildId: guildId,
        name: "Detail Test Game",
        slug: `detail-game-${suffix}`,
      })
      .returning({ id: gameProjects.id });
    projectId = project!.id;

    const [build] = await database
      .insert(builds)
      .values({ projectId, version: `detail-build-${suffix}` })
      .returning({ id: builds.id });

    const created = await createBugReport(database, {
      projectId,
      buildId: build!.id,
      title: "Long detail integration report",
      severity: "high",
      actualResult: "The screen freezes.",
      expectedResult: "The screen remains interactive.",
      reproductionSteps: "1. Open inventory\n2. Close the cutscene",
      platform: "Windows 11",
      location: "Dungeon entrance",
      frequency: "Always",
      reporterDiscordUserId: `detail-reporter-${suffix}`,
      reporterDisplayName: "Detail Reporter",
      discordGuildId: `detail-guild-${suffix}`,
      sourceChannelId: `detail-channel-${suffix}`,
      discordInteractionId: `detail-interaction-${suffix}`,
    });
    reportId = created.id;

    await database.insert(attachments).values({
      reportId,
      storagePath: `detail/${suffix}/freeze.png`,
      originalFilename: "freeze.png",
      contentType: "image/png",
      sizeBytes: 2048,
      sha256: "a".repeat(64),
    });
    await database
      .update(statusEvents)
      .set({ createdAt: new Date("2026-08-20T01:00:00.000Z") })
      .where(eq(statusEvents.reportId, reportId));
    await database.insert(statusEvents).values({
      reportId,
      eventType: "investigation_started",
      fromStatus: "new",
      toStatus: "investigating",
      actorUserId: userId,
      note: "Reproducing locally",
      createdAt: new Date("2026-08-20T02:00:00.000Z"),
    });
    await database
      .update(bugReports)
      .set({ status: "investigating", version: 1 })
      .where(eq(bugReports.id, reportId));
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

  it("maps input, nullable relations, attachments, and chronologically sorted events", async () => {
    const repository = new DrizzleReportDetailQueryRepository(database);

    await expect(repository.findReportProjectId(reportId)).resolves.toBe(projectId);
    const detail = await repository.findReportDetail(reportId);

    expect(detail).toMatchObject({
      id: reportId,
      projectId,
      status: "investigating",
      build: { version: `detail-build-${suffix}` },
      fixedBuild: null,
      canonicalReport: null,
      environment: null,
      location: "Dungeon entrance",
      attachments: [{ originalFilename: "freeze.png", sizeBytes: 2048 }],
      statusEvents: [
        { eventType: "report_created", actor: null },
        {
          eventType: "investigation_started",
          actor: { id: userId, displayName: "Detail Admin" },
        },
      ],
    });
  });

  it("treats soft-deleted reports as not found", async () => {
    const repository = new DrizzleReportDetailQueryRepository(database);
    await database
      .update(bugReports)
      .set({ deletedAt: new Date() })
      .where(eq(bugReports.id, reportId));

    await expect(repository.findReportProjectId(reportId)).resolves.toBeNull();
    await expect(repository.findReportDetail(reportId)).resolves.toBeNull();
  });
});
