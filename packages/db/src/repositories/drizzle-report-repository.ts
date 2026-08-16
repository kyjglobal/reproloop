import { and, eq, isNull, or } from "drizzle-orm";

import {
  ReportDomainError,
  type ReportRepository,
  type ReportSnapshot,
  type ReportTransaction,
} from "@reproloop/domain";

import type { Database } from "../client.js";
import { bugReports, statusEvents } from "../schema/index.js";

type TransactionDatabase = Parameters<Parameters<Database["transaction"]>[0]>[0];

class DrizzleReportTransaction implements ReportTransaction {
  constructor(private readonly transactionDatabase: TransactionDatabase) {}

  async updateReport(input: Parameters<ReportTransaction["updateReport"]>[0]): Promise<void> {
    const values = {
      status: input.status,
      version: input.expectedVersion + 1,
      updatedAt: new Date(),
      ...(input.canonicalReportId !== undefined
        ? { canonicalReportId: input.canonicalReportId }
        : {}),
      ...(input.fixedBuildId !== undefined ? { fixedBuildId: input.fixedBuildId } : {}),
      ...(input.resolvedAt !== undefined ? { resolvedAt: input.resolvedAt } : {}),
    };

    const updated = await this.transactionDatabase
      .update(bugReports)
      .set(values)
      .where(
        and(
          eq(bugReports.id, input.reportId),
          eq(bugReports.version, input.expectedVersion),
          isNull(bugReports.deletedAt),
        ),
      )
      .returning({ id: bugReports.id });

    if (updated.length === 0) {
      throw new ReportDomainError("CONFLICT", "다른 사용자가 먼저 제보를 수정했습니다.");
    }
  }

  async addStatusEvent(input: Parameters<ReportTransaction["addStatusEvent"]>[0]): Promise<void> {
    await this.transactionDatabase.insert(statusEvents).values({
      reportId: input.reportId,
      eventType: input.eventType,
      fromStatus: input.fromStatus,
      toStatus: input.toStatus,
      actorUserId: input.actorId,
      note: input.note,
    });
  }
}

export class DrizzleReportRepository implements ReportRepository {
  constructor(private readonly database: Database) {}

  async findById(reportId: string): Promise<ReportSnapshot | null> {
    const [report] = await this.database
      .select({
        id: bugReports.id,
        projectId: bugReports.projectId,
        status: bugReports.status,
        version: bugReports.version,
        canonicalReportId: bugReports.canonicalReportId,
        fixedBuildId: bugReports.fixedBuildId,
        deletedAt: bugReports.deletedAt,
      })
      .from(bugReports)
      .where(eq(bugReports.id, reportId))
      .limit(1);

    return report ?? null;
  }

  async listCanonicalAncestorIds(reportId: string): Promise<readonly string[]> {
    const ancestorIds: string[] = [];
    const visitedIds = new Set<string>([reportId]);
    let currentId: string | null = reportId;

    while (currentId) {
      const [report] = await this.database
        .select({ canonicalReportId: bugReports.canonicalReportId })
        .from(bugReports)
        .where(eq(bugReports.id, currentId))
        .limit(1);

      const canonicalReportId: string | null = report?.canonicalReportId ?? null;
      if (!canonicalReportId || visitedIds.has(canonicalReportId)) {
        break;
      }

      visitedIds.add(canonicalReportId);
      ancestorIds.push(canonicalReportId);
      currentId = canonicalReportId;
    }

    return ancestorIds;
  }

  async listRelatedReporterDiscordUserIds(
    canonicalReportId: string,
  ): Promise<readonly string[]> {
    const rows = await this.database
      .select({ reporterDiscordUserId: bugReports.reporterDiscordUserId })
      .from(bugReports)
      .where(
        and(
          or(
            eq(bugReports.id, canonicalReportId),
            eq(bugReports.canonicalReportId, canonicalReportId),
          ),
          isNull(bugReports.deletedAt),
        ),
      );

    return rows.map((row) => row.reporterDiscordUserId);
  }

  transaction<TResult>(
    work: (transaction: ReportTransaction) => Promise<TResult>,
  ): Promise<TResult> {
    return this.database.transaction((transactionDatabase) =>
      work(new DrizzleReportTransaction(transactionDatabase)),
    );
  }
}
