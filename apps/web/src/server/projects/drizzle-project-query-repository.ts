import type { Database } from "@reproloop/db/client";
import { gameProjects, organizationMembers, organizations } from "@reproloop/db/schema";
import { and, asc, eq, isNull } from "drizzle-orm";

import type { ProjectQueryRepository } from "./types";

const projectSelection = {
  id: gameProjects.id,
  organizationId: gameProjects.organizationId,
  organizationName: organizations.name,
  name: gameProjects.name,
  slug: gameProjects.slug,
  defaultLocale: gameProjects.defaultLocale,
  role: organizationMembers.role,
};

export class DrizzleProjectQueryRepository implements ProjectQueryRepository {
  constructor(private readonly database: Database) {}

  listAccessibleProjects(userId: string) {
    return this.database
      .select(projectSelection)
      .from(gameProjects)
      .innerJoin(organizations, eq(organizations.id, gameProjects.organizationId))
      .innerJoin(
        organizationMembers,
        and(
          eq(organizationMembers.organizationId, gameProjects.organizationId),
          eq(organizationMembers.userId, userId),
        ),
      )
      .where(isNull(gameProjects.archivedAt))
      .orderBy(asc(organizations.name), asc(gameProjects.name), asc(gameProjects.id));
  }

  async findAccessibleProject(input: { projectId: string; userId: string }) {
    const [project] = await this.database
      .select(projectSelection)
      .from(gameProjects)
      .innerJoin(organizations, eq(organizations.id, gameProjects.organizationId))
      .innerJoin(
        organizationMembers,
        and(
          eq(organizationMembers.organizationId, gameProjects.organizationId),
          eq(organizationMembers.userId, input.userId),
        ),
      )
      .where(and(eq(gameProjects.id, input.projectId), isNull(gameProjects.archivedAt)))
      .limit(1);

    return project ?? null;
  }
}
