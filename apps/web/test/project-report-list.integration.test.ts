import { createBugReport } from "@reproloop/db";
import { createDatabase, type Database, type DatabaseConnection } from "@reproloop/db/client";
import {
  builds,
  discordGuilds,
  gameProjects,
  organizationMembers,
  organizations,
  users,
} from "@reproloop/db/schema";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { DrizzleProjectQueryRepository } from "../src/server/projects/drizzle-project-query-repository";
import { DrizzleReportListQueryRepository } from "../src/server/reports/drizzle-report-list-query-repository";

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const describeWithDatabase = testDatabaseUrl ? describe : describe.skip;

describeWithDatabase("project and report list database integration", () => {
  let connection: DatabaseConnection;
  let database: Database;
  let userId: string;
  let organizationId: string;
  let guildId: string;
  let projectId: string;
  let buildId: string;

  const suffix = crypto.randomUUID();
  const discordGuildId = `web-list-guild-${suffix}`;

  beforeAll(async () => {
    connection = createDatabase(testDatabaseUrl!, { maxConnections: 1 });
    database = connection.database;

    const [user] = await database
      .insert(users)
      .values({
        discordUserId: `web-list-user-${suffix}`,
        displayName: "Web List Tester",
      })
      .returning({ id: users.id });
    userId = user!.id;

    const [organization] = await database
      .insert(organizations)
      .values({
        name: "Web List Test Organization",
        slug: `web-list-${suffix}`,
        createdByUserId: userId,
      })
      .returning({ id: organizations.id });
    organizationId = organization!.id;

    const [guild] = await database
      .insert(discordGuilds)
      .values({
        organizationId,
        discordGuildId,
        name: "Web List Test Guild",
        installedByUserId: userId,
      })
      .returning({ id: discordGuilds.id });
    guildId = guild!.id;

    await database.insert(organizationMembers).values({
      organizationId,
      userId,
      role: "admin",
      verifiedViaGuildId: guildId,
      verifiedAt: new Date(),
    });

    const [project] = await database
      .insert(gameProjects)
      .values({
        organizationId,
        discordGuildId: guildId,
        name: "Web List Test Game",
        slug: `web-list-game-${suffix}`,
      })
      .returning({ id: gameProjects.id });
    projectId = project!.id;

    const [build] = await database
      .insert(builds)
      .values({ projectId, version: `web-list-${suffix}` })
      .returning({ id: builds.id });
    buildId = build!.id;

    await createBugReport(database, {
      projectId,
      buildId,
      title: "Inventory input freezes the game",
      severity: "high",
      actualResult: "The game stops responding.",
      expectedResult: "The inventory should open.",
      reproductionSteps: "Open the inventory during a cutscene.",
      platform: "Windows 11",
      frequency: "3/5",
      reporterDiscordUserId: `web-list-reporter-${suffix}`,
      reporterDisplayName: "Player One",
      discordGuildId,
      sourceChannelId: `web-list-channel-${suffix}`,
      discordInteractionId: `web-list-interaction-${suffix}`,
    });
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

  it("queries an accessible project and its report list", async () => {
    const projectRepository = new DrizzleProjectQueryRepository(database);

    await expect(projectRepository.listAccessibleProjects(userId)).resolves.toEqual([
      expect.objectContaining({ id: projectId, role: "admin" }),
    ]);

    const reportRepository = new DrizzleReportListQueryRepository(database);
    const page = await reportRepository.listProjectReports({
      projectId,
      query: { limit: 20 },
    });

    expect(page).toMatchObject({
      items: [
        {
          projectId,
          title: "Inventory input freezes the game",
          build: { id: buildId },
          duplicateCount: 0,
        },
      ],
      nextCursor: null,
    });
  });
});
