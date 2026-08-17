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
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { DISCORD_BUG_MODAL_FIELD_IDS } from "../src/server/discord/constants";
import { DrizzleDiscordBugRepository } from "../src/server/discord/drizzle-discord-bug-repository";
import { handleDiscordInteraction } from "../src/server/discord/interaction-handler";
import { createBugModalCustomId } from "../src/server/discord/interaction-parser";

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const describeWithDatabase = testDatabaseUrl ? describe : describe.skip;

describeWithDatabase("Discord bug database integration", () => {
  let connection: DatabaseConnection;
  let database: Database;
  let repository: DrizzleDiscordBugRepository;
  let userId: string;
  let organizationId: string;
  let guildId: string;
  let projectId: string;
  let buildId: string;

  const suffix = crypto.randomUUID();
  const externalGuildId = `discord-bug-guild-${suffix}`;

  beforeAll(async () => {
    connection = createDatabase(testDatabaseUrl!, { maxConnections: 1 });
    database = connection.database;
    repository = new DrizzleDiscordBugRepository(database);

    const [user] = await database
      .insert(users)
      .values({
        discordUserId: `discord-bug-user-${suffix}`,
        displayName: "Discord Bug Tester",
      })
      .returning({ id: users.id });
    userId = user!.id;

    const [organization] = await database
      .insert(organizations)
      .values({
        name: "Discord Bug Test Organization",
        slug: `discord-bug-${suffix}`,
        createdByUserId: userId,
      })
      .returning({ id: organizations.id });
    organizationId = organization!.id;

    const [guild] = await database
      .insert(discordGuilds)
      .values({
        organizationId,
        discordGuildId: externalGuildId,
        name: "Discord Bug Test Guild",
        installedByUserId: userId,
      })
      .returning({ id: discordGuilds.id });
    guildId = guild!.id;

    const [project] = await database
      .insert(gameProjects)
      .values({
        organizationId,
        discordGuildId: guildId,
        name: "Discord Bug Test Game",
        slug: `discord-bug-game-${suffix}`,
      })
      .returning({ id: gameProjects.id });
    projectId = project!.id;

    const [build] = await database
      .insert(builds)
      .values({ projectId, version: `discord-bug-build-${suffix}` })
      .returning({ id: builds.id });
    buildId = build!.id;

    await database.insert(builds).values({
      projectId,
      version: `discord-bug-inactive-${suffix}`,
      isActive: false,
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

  function modalPayload() {
    const fields = {
      [DISCORD_BUG_MODAL_FIELD_IDS.actualResult]: "통합 테스트에서 게임이 멈춥니다.",
      [DISCORD_BUG_MODAL_FIELD_IDS.expectedResult]: "게임이 계속 실행되어야 합니다.",
      [DISCORD_BUG_MODAL_FIELD_IDS.reproductionSteps]: "통합 테스트 순서를 실행합니다.",
      [DISCORD_BUG_MODAL_FIELD_IDS.platform]: "Windows 11",
      [DISCORD_BUG_MODAL_FIELD_IDS.frequency]: "항상",
    };

    return {
      id: `discord-bug-interaction-${suffix}`,
      type: 5,
      guild_id: externalGuildId,
      channel_id: `discord-bug-channel-${suffix}`,
      member: {
        nick: "DB 테스터",
        user: { id: `discord-reporter-${suffix}`, username: "db-tester" },
      },
      data: {
        custom_id: createBugModalCustomId({ projectId, buildId }),
        components: Object.entries(fields).map(([customId, value]) => ({
          components: [{ custom_id: customId, value }],
        })),
      },
    };
  }

  it("only offers projects and active builds connected to the Discord guild", async () => {
    await expect(
      repository.listProjectChoices({ discordGuildId: externalGuildId, query: "Test" }),
    ).resolves.toEqual([{ name: "Discord Bug Test Game", value: projectId }]);

    await expect(
      repository.listBuildChoices({
        discordGuildId: externalGuildId,
        projectId,
        query: "discord-bug",
      }),
    ).resolves.toEqual([{ name: `discord-bug-build-${suffix}`, value: buildId }]);

    await expect(
      repository.selectionExists({
        discordGuildId: "another-guild",
        projectId,
        buildId,
      }),
    ).resolves.toBe(false);
  });

  it("stores one report and one event when Discord retries the same modal submit", async () => {
    const payload = modalPayload();
    const first = await handleDiscordInteraction(payload, repository);
    const retried = await handleDiscordInteraction(payload, repository);

    expect(first).toEqual(retried);
    expect(first).toMatchObject({ data: { content: "BUG-1이 접수되었습니다.", flags: 64 } });

    const reports = await database
      .select({ id: bugReports.id })
      .from(bugReports)
      .where(eq(bugReports.discordInteractionId, payload.id));
    expect(reports).toHaveLength(1);

    const events = await database
      .select({ eventType: statusEvents.eventType })
      .from(statusEvents)
      .where(eq(statusEvents.reportId, reports[0]!.id));
    expect(events).toEqual([{ eventType: "report_created" }]);
  });
});
