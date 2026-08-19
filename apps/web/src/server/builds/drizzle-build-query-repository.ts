import type { Database } from "@reproloop/db/client";
import { builds } from "@reproloop/db/schema";
import { asc, desc, eq } from "drizzle-orm";

import type { BuildQueryRepository } from "./types";

export class DrizzleBuildQueryRepository implements BuildQueryRepository {
  constructor(private readonly database: Database) {}

  async listProjectBuilds(projectId: string) {
    const rows = await this.database
      .select({
        id: builds.id,
        projectId: builds.projectId,
        version: builds.version,
        isActive: builds.isActive,
        releasedAt: builds.releasedAt,
      })
      .from(builds)
      .where(eq(builds.projectId, projectId))
      .orderBy(desc(builds.releasedAt), asc(builds.version), asc(builds.id));

    return rows.map((row) => ({
      ...row,
      releasedAt: row.releasedAt?.toISOString() ?? null,
    }));
  }
}
