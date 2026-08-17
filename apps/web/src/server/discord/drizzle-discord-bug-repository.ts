import { createBugReport } from "@reproloop/db";
import type { Database } from "@reproloop/db/client";
import { builds, discordGuilds, gameProjects } from "@reproloop/db/schema";
import type { CreateBugReportCommand } from "@reproloop/shared";
import { and, asc, eq, ilike, isNull, or } from "drizzle-orm";

import { DISCORD_AUTOCOMPLETE_CHOICE_LIMIT } from "./constants";
import type { DiscordBugRepository } from "./types";

function containsQuery(value: string) {
  const escaped = value.replace(/[\\%_]/g, (character) => `\\${character}`);
  return `%${escaped}%`;
}

function choiceName(value: string): string {
  return value.length <= 100 ? value : `${value.slice(0, 99)}…`;
}

export class DrizzleDiscordBugRepository implements DiscordBugRepository {
  constructor(private readonly database: Database) {}

  async listProjectChoices(input: { discordGuildId: string; query: string }) {
    const query = input.query.trim();
    const rows = await this.database
      .select({ id: gameProjects.id, name: gameProjects.name, slug: gameProjects.slug })
      .from(gameProjects)
      .innerJoin(discordGuilds, eq(gameProjects.discordGuildId, discordGuilds.id))
      .where(
        and(
          eq(discordGuilds.discordGuildId, input.discordGuildId),
          isNull(discordGuilds.removedAt),
          isNull(gameProjects.archivedAt),
          query
            ? or(
                ilike(gameProjects.name, containsQuery(query)),
                ilike(gameProjects.slug, containsQuery(query)),
              )
            : undefined,
        ),
      )
      .orderBy(asc(gameProjects.name), asc(gameProjects.id))
      .limit(DISCORD_AUTOCOMPLETE_CHOICE_LIMIT);

    return rows.map((row) => ({ name: choiceName(row.name), value: row.id }));
  }

  async listBuildChoices(input: {
    discordGuildId: string;
    projectId: string;
    query: string;
  }) {
    const query = input.query.trim();
    const rows = await this.database
      .select({ id: builds.id, version: builds.version })
      .from(builds)
      .innerJoin(gameProjects, eq(builds.projectId, gameProjects.id))
      .innerJoin(discordGuilds, eq(gameProjects.discordGuildId, discordGuilds.id))
      .where(
        and(
          eq(discordGuilds.discordGuildId, input.discordGuildId),
          eq(gameProjects.id, input.projectId),
          eq(builds.isActive, true),
          isNull(discordGuilds.removedAt),
          isNull(gameProjects.archivedAt),
          query ? ilike(builds.version, containsQuery(query)) : undefined,
        ),
      )
      .orderBy(asc(builds.version), asc(builds.id))
      .limit(DISCORD_AUTOCOMPLETE_CHOICE_LIMIT);

    return rows.map((row) => ({ name: choiceName(row.version), value: row.id }));
  }

  async selectionExists(input: {
    discordGuildId: string;
    projectId: string;
    buildId: string;
  }): Promise<boolean> {
    const [selection] = await this.database
      .select({ projectId: gameProjects.id })
      .from(gameProjects)
      .innerJoin(discordGuilds, eq(gameProjects.discordGuildId, discordGuilds.id))
      .innerJoin(builds, eq(builds.projectId, gameProjects.id))
      .where(
        and(
          eq(discordGuilds.discordGuildId, input.discordGuildId),
          eq(gameProjects.id, input.projectId),
          eq(builds.id, input.buildId),
          eq(builds.isActive, true),
          isNull(discordGuilds.removedAt),
          isNull(gameProjects.archivedAt),
        ),
      )
      .limit(1);

    return Boolean(selection);
  }

  createReport(command: CreateBugReportCommand) {
    return createBugReport(this.database, command);
  }
}
