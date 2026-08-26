import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import {
  mergeDuplicateReport,
  ReportDomainError,
  resolveReportFixNotificationAudience,
  unmergeDuplicateReport,
} from "@reproloop/domain";
import type { CreateBugReportCommand } from "@reproloop/shared";

import {
  bugReports,
  builds,
  createBugReport,
  createDatabase,
  discordGuilds,
  DrizzleReportRepository,
  gameProjects,
  organizations,
  notifications,
  statusEvents,
  users,
  type Database,
  type DatabaseConnection,
} from "../src/index.js";

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const describeWithDatabase = testDatabaseUrl ? describe : describe.skip;

describeWithDatabase("report persistence integration", () => {
  let connection: DatabaseConnection;
  let database: Database;
  let userId: string;
  let organizationId: string;
  let guildId: string;
  let projectId: string;
  let buildId: string;

  const suffix = crypto.randomUUID();
  const discordGuildId = `integration-guild-${suffix}`;

  beforeAll(async () => {
    connection = createDatabase(testDatabaseUrl!, { maxConnections: 1 });
    database = connection.database;

    const [user] = await database
      .insert(users)
      .values({
        discordUserId: `integration-user-${suffix}`,
        displayName: "Integration Tester",
      })
      .returning({ id: users.id });
    userId = user!.id;

    const [organization] = await database
      .insert(organizations)
      .values({
        name: "Integration Organization",
        slug: `integration-${suffix}`,
        createdByUserId: userId,
      })
      .returning({ id: organizations.id });
    organizationId = organization!.id;

    const [guild] = await database
      .insert(discordGuilds)
      .values({
        organizationId,
        discordGuildId,
        name: "Integration Guild",
        installedByUserId: userId,
      })
      .returning({ id: discordGuilds.id });
    guildId = guild!.id;

    const [project] = await database
      .insert(gameProjects)
      .values({
        organizationId,
        discordGuildId: guildId,
        name: "Integration Game",
        slug: `integration-game-${suffix}`,
      })
      .returning({ id: gameProjects.id });
    projectId = project!.id;

    const [build] = await database
      .insert(builds)
      .values({
        projectId,
        version: `integration-${suffix}`,
      })
      .returning({ id: builds.id });
    buildId = build!.id;
  });

  afterAll(async () => {
    if (!database || !connection) {
      return;
    }

    if (projectId) {
      await database.delete(gameProjects).where(eq(gameProjects.id, projectId));
    }
    if (guildId) {
      await database.delete(discordGuilds).where(eq(discordGuilds.id, guildId));
    }
    if (organizationId) {
      await database.delete(organizations).where(eq(organizations.id, organizationId));
    }
    if (userId) {
      await database.delete(users).where(eq(users.id, userId));
    }
    await connection.close();
  });

  function createCommand(
    discordInteractionId: string,
    reporterDiscordUserId = `reporter-${suffix}`,
  ): CreateBugReportCommand {
    return {
      projectId,
      buildId,
      title: "Inventory input freezes the game",
      severity: "medium",
      actualResult: "The game stops responding.",
      expectedResult: "The inventory should open.",
      reproductionSteps: "Press the inventory key during the cutscene.",
      platform: "Windows 11",
      frequency: "3/5",
      reporterDiscordUserId,
      reporterDisplayName: "Player One",
      discordGuildId,
      sourceChannelId: `channel-${suffix}`,
      discordInteractionId,
    };
  }

  it("stores one report and one created event for a retried Discord interaction", async () => {
    const interactionId = `interaction-${crypto.randomUUID()}`;
    const command = createCommand(interactionId);

    const first = await createBugReport(database, command);
    const retried = await createBugReport(database, command);

    expect(first.created).toBe(true);
    expect(retried).toEqual({ ...first, created: false });

    const reports = await database
      .select({ id: bugReports.id })
      .from(bugReports)
      .where(eq(bugReports.discordInteractionId, interactionId));
    const events = await database
      .select({ id: statusEvents.id, eventType: statusEvents.eventType })
      .from(statusEvents)
      .where(eq(statusEvents.reportId, first.id));

    expect(reports).toHaveLength(1);
    expect(events).toEqual([expect.objectContaining({ eventType: "report_created" })]);
  });

  it("rolls back a report update when its status event insert fails", async () => {
    const created = await createBugReport(
      database,
      createCommand(`interaction-${crypto.randomUUID()}`),
    );
    const repository = new DrizzleReportRepository(database);

    await expect(
      repository.transaction(async (transaction) => {
        await transaction.updateReport({
          reportId: created.id,
          expectedVersion: 0,
          status: "investigating",
        });
        await transaction.addStatusEvent({
          reportId: created.id,
          eventType: "investigation_started",
          fromStatus: "new",
          toStatus: "investigating",
          actorId: crypto.randomUUID(),
        });
      }),
    ).rejects.toBeTruthy();

    const [reportAfterRollback] = await database
      .select({ status: bugReports.status, version: bugReports.version })
      .from(bugReports)
      .where(eq(bugReports.id, created.id));

    expect(reportAfterRollback).toEqual({ status: "new", version: 0 });
  });

  it("rejects a stale expectedVersion without changing the report", async () => {
    const created = await createBugReport(
      database,
      createCommand(`interaction-${crypto.randomUUID()}`),
    );
    const repository = new DrizzleReportRepository(database);

    await repository.transaction((transaction) =>
      transaction.updateReport({
        reportId: created.id,
        expectedVersion: 0,
        status: "investigating",
      }),
    );

    await expect(
      repository.transaction((transaction) =>
        transaction.updateReport({
          reportId: created.id,
          expectedVersion: 0,
          status: "reproduced",
        }),
      ),
    ).rejects.toMatchObject({ code: "CONFLICT" } satisfies Partial<ReportDomainError>);

    const snapshot = await repository.findById(created.id);
    expect(snapshot).toMatchObject({ status: "investigating", version: 1 });
  });

  it("merges and unmerges using the status stored in event metadata", async () => {
    const target = await createBugReport(
      database,
      createCommand(`interaction-${crypto.randomUUID()}`),
    );
    const canonical = await createBugReport(
      database,
      createCommand(`interaction-${crypto.randomUUID()}`),
    );
    const repository = new DrizzleReportRepository(database);

    await mergeDuplicateReport(repository, {
      targetReportId: target.id,
      canonicalReportId: canonical.id,
      actorId: userId,
      actorRole: "admin",
      expectedVersion: 0,
    });

    expect(await repository.findById(target.id)).toMatchObject({
      status: "duplicate",
      canonicalReportId: canonical.id,
      version: 1,
    });

    const events = await database
      .select({ eventType: statusEvents.eventType, metadata: statusEvents.metadata })
      .from(statusEvents)
      .where(eq(statusEvents.reportId, target.id));

    expect(events).toContainEqual({
      eventType: "duplicate_merged",
      metadata: { previousStatus: "new", canonicalReportId: canonical.id },
    });
    await unmergeDuplicateReport(repository, {
      targetReportId: target.id,
      actorId: userId,
      actorRole: "owner",
      expectedVersion: 1,
    });

    expect(await repository.findById(target.id)).toMatchObject({
      status: "new",
      canonicalReportId: null,
      version: 2,
    });
  });

  it("resolves unique canonical and duplicate recipients and rejects a retried notification", async () => {
    const canonical = await createBugReport(
      database,
      createCommand(`interaction-${crypto.randomUUID()}`, "recipient-a"),
    );
    const sameReporterDuplicate = await createBugReport(
      database,
      createCommand(`interaction-${crypto.randomUUID()}`, "recipient-a"),
    );
    const otherReporterDuplicate = await createBugReport(
      database,
      createCommand(`interaction-${crypto.randomUUID()}`, "recipient-b"),
    );
    const deletedDuplicate = await createBugReport(
      database,
      createCommand(`interaction-${crypto.randomUUID()}`, "recipient-deleted"),
    );

    for (const reportId of [
      sameReporterDuplicate.id,
      otherReporterDuplicate.id,
      deletedDuplicate.id,
    ]) {
      await database
        .update(bugReports)
        .set({ status: "duplicate", canonicalReportId: canonical.id })
        .where(eq(bugReports.id, reportId));
    }
    await database
      .update(bugReports)
      .set({ deletedAt: new Date() })
      .where(eq(bugReports.id, deletedDuplicate.id));

    const enqueueNotificationJob = vi.fn(async () => undefined);
    const repository = new DrizzleReportRepository(database, enqueueNotificationJob);
    const fromCanonical = await repository.transaction((transaction) =>
      resolveReportFixNotificationAudience(transaction, canonical.id),
    );
    const fromDuplicate = await resolveReportFixNotificationAudience(
      repository,
      otherReporterDuplicate.id,
    );

    const expectedAudience = {
      canonicalReportId: canonical.id,
      relatedReportIds: expect.arrayContaining([
        canonical.id,
        sameReporterDuplicate.id,
        otherReporterDuplicate.id,
      ]),
      recipientDiscordUserIds: ["recipient-a", "recipient-b"],
    };
    expect(fromCanonical).toEqual(expectedAudience);
    expect(fromCanonical.relatedReportIds).toHaveLength(3);
    expect(fromDuplicate).toEqual(fromCanonical);

    const [createdEvent] = await database
      .insert(statusEvents)
      .values({
        reportId: canonical.id,
        eventType: "report_fixed",
        fromStatus: "reproduced",
        toStatus: "fixed",
        actorUserId: userId,
      })
      .returning({ id: statusEvents.id });
    const notificationInput = {
      reportId: fromCanonical.canonicalReportId,
      statusEventId: createdEvent!.id,
      type: "report_fixed" as const,
      recipientDiscordUserIds: fromCanonical.recipientDiscordUserIds,
    };
    const savedIds = await repository.transaction((transaction) =>
      transaction.addNotifications(notificationInput),
    );
    expect(enqueueNotificationJob).toHaveBeenCalledTimes(2);
    expect(enqueueNotificationJob.mock.calls.map(([, job]) => job)).toEqual(
      savedIds.map((notificationId) => ({
        jobName: "notification.send.v1",
        version: 1,
        notificationId,
      })),
    );
    await expect(
      repository.transaction((transaction) =>
        transaction.addNotifications(notificationInput),
      ),
    ).rejects.toBeTruthy();

    const savedNotifications = await database
      .select({
        recipientDiscordUserId: notifications.recipientDiscordUserId,
        idempotencyKey: notifications.idempotencyKey,
      })
      .from(notifications)
      .where(eq(notifications.statusEventId, createdEvent!.id));
    expect(savedNotifications).toHaveLength(2);
    expect(savedNotifications.map(({ recipientDiscordUserId }) => recipientDiscordUserId)).toEqual(
      expect.arrayContaining(["recipient-a", "recipient-b"]),
    );
  });
});
