import type { Database } from "@reproloop/db/client";
import { bugReports, builds } from "@reproloop/db/schema";
import type { ReportListItem } from "@reproloop/shared";
import {
  and,
  count,
  desc,
  eq,
  ilike,
  inArray,
  isNull,
  lt,
  or,
  type SQL,
} from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import { decodeReportCursor, encodeReportCursor } from "./cursor";
import type { ReportListQueryRepository } from "./types";

const duplicateReports = alias(bugReports, "duplicate_reports");

export class DrizzleReportListQueryRepository implements ReportListQueryRepository {
  constructor(private readonly database: Database) {}

  async listProjectReports(input: Parameters<ReportListQueryRepository["listProjectReports"]>[0]) {
    const { projectId, query } = input;
    const conditions: SQL[] = [
      eq(bugReports.projectId, projectId),
      isNull(bugReports.deletedAt),
    ];

    if (query.status) {
      conditions.push(inArray(bugReports.status, query.status));
    }
    if (query.buildId) {
      conditions.push(eq(bugReports.buildId, query.buildId));
    }
    if (query.search) {
      conditions.push(ilike(bugReports.title, `%${query.search}%`));
    }
    if (query.cursor) {
      const cursor = decodeReportCursor(query.cursor);
      const cursorCondition = or(
        lt(bugReports.createdAt, cursor.createdAt),
        and(eq(bugReports.createdAt, cursor.createdAt), lt(bugReports.id, cursor.id)),
      );

      if (cursorCondition) {
        conditions.push(cursorCondition);
      }
    }

    const rows = await this.database
      .select({
        id: bugReports.id,
        projectId: bugReports.projectId,
        reportNumber: bugReports.reportNumber,
        title: bugReports.title,
        status: bugReports.status,
        severity: bugReports.severity,
        buildId: builds.id,
        buildVersion: builds.version,
        reporterDisplayName: bugReports.reporterDisplayName,
        duplicateCount: count(duplicateReports.id),
        createdAt: bugReports.createdAt,
        version: bugReports.version,
      })
      .from(bugReports)
      .innerJoin(builds, eq(builds.id, bugReports.buildId))
      .leftJoin(
        duplicateReports,
        and(
          eq(duplicateReports.canonicalReportId, bugReports.id),
          isNull(duplicateReports.deletedAt),
        ),
      )
      .where(and(...conditions))
      .groupBy(
        bugReports.id,
        bugReports.projectId,
        bugReports.reportNumber,
        bugReports.title,
        bugReports.status,
        bugReports.severity,
        builds.id,
        builds.version,
        bugReports.reporterDisplayName,
        bugReports.createdAt,
        bugReports.version,
      )
      .orderBy(desc(bugReports.createdAt), desc(bugReports.id))
      .limit(query.limit + 1);

    const hasNextPage = rows.length > query.limit;
    const pageRows = hasNextPage ? rows.slice(0, query.limit) : rows;
    const lastRow = pageRows.at(-1);
    const items: ReportListItem[] = pageRows.map((row) => ({
      id: row.id,
      projectId: row.projectId,
      reportNumber: row.reportNumber,
      title: row.title,
      status: row.status,
      severity: row.severity,
      build: { id: row.buildId, version: row.buildVersion },
      reporterDisplayName: row.reporterDisplayName,
      duplicateCount: row.duplicateCount,
      createdAt: row.createdAt.toISOString(),
      version: row.version,
    }));

    return {
      items,
      nextCursor:
        hasNextPage && lastRow
          ? encodeReportCursor({ createdAt: lastRow.createdAt, id: lastRow.id })
          : null,
    };
  }
}
