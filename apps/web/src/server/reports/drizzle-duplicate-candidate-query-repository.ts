import type { Database } from "@reproloop/db/client";
import { bugReports, builds } from "@reproloop/db/schema";
import type { DuplicateCandidate } from "@reproloop/shared";
import { and, desc, eq, ilike, isNull, ne, type SQL } from "drizzle-orm";

import type { DuplicateCandidateQueryRepository } from "./types";

export class DrizzleDuplicateCandidateQueryRepository
  implements DuplicateCandidateQueryRepository
{
  constructor(private readonly database: Database) {}

  async findCandidateTargetProjectId(targetReportId: string): Promise<string | null> {
    const [target] = await this.database
      .select({ projectId: bugReports.projectId })
      .from(bugReports)
      .where(and(eq(bugReports.id, targetReportId), isNull(bugReports.deletedAt)))
      .limit(1);

    return target?.projectId ?? null;
  }

  async listDuplicateCandidates(
    input: Parameters<DuplicateCandidateQueryRepository["listDuplicateCandidates"]>[0],
  ): Promise<DuplicateCandidate[]> {
    const conditions: SQL[] = [
      eq(bugReports.projectId, input.projectId),
      ne(bugReports.id, input.targetReportId),
      ne(bugReports.status, "duplicate"),
      isNull(bugReports.deletedAt),
    ];

    if (input.query.search) {
      conditions.push(ilike(bugReports.title, `%${input.query.search}%`));
    }

    const rows = await this.database
      .select({
        id: bugReports.id,
        reportNumber: bugReports.reportNumber,
        title: bugReports.title,
        status: bugReports.status,
        buildId: builds.id,
        buildVersion: builds.version,
        createdAt: bugReports.createdAt,
      })
      .from(bugReports)
      .innerJoin(builds, eq(builds.id, bugReports.buildId))
      .where(and(...conditions))
      .orderBy(desc(bugReports.createdAt), desc(bugReports.id))
      .limit(input.query.limit);

    return rows.map((row) => ({
      id: row.id,
      reportNumber: row.reportNumber,
      title: row.title,
      status: row.status as DuplicateCandidate["status"],
      build: { id: row.buildId, version: row.buildVersion },
      createdAt: row.createdAt.toISOString(),
    }));
  }
}
