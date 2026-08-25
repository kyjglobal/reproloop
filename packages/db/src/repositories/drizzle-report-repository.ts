import { and, desc, eq, inArray, isNull, or } from "drizzle-orm";

import {
  ReportDomainError,
  type ReportRepository,
  type ReportSnapshot,
  type ReportTransaction,
} from "@reproloop/domain";
import type { NotificationSendJobV1 } from "@reproloop/shared";

import type { Database, DatabaseTransaction } from "../client.js";
import { bugReports, builds, notifications, statusEvents } from "../schema/index.js";

type ReportDatabase = Database | DatabaseTransaction;

export type NotificationJobEnqueuer = (
  transaction: DatabaseTransaction,
  job: NotificationSendJobV1,
) => Promise<void>;

async function findReportById(
  database: ReportDatabase,
  reportId: string,
): Promise<ReportSnapshot | null> {
  const [report] = await database
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

async function listCanonicalAncestors(
  database: ReportDatabase,
  reportId: string,
): Promise<readonly string[]> {
  const ancestorIds: string[] = [];
  const visitedIds = new Set<string>([reportId]);
  let currentId: string | null = reportId;

  while (currentId) {
    const [report] = await database
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

async function listRelatedReporterDiscordUserIds(
  database: ReportDatabase,
  canonicalReportId: string,
): Promise<readonly string[]> {
  const rows = await database
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

class DrizzleReportTransaction implements ReportTransaction {
  constructor(
    private readonly transactionDatabase: DatabaseTransaction,
    private readonly notificationJobEnqueuer?: NotificationJobEnqueuer,
  ) {}

  findById(reportId: string): Promise<ReportSnapshot | null> {
    return findReportById(this.transactionDatabase, reportId);
  }

  async findBuildProjectId(buildId: string): Promise<string | null> {
    const [build] = await this.transactionDatabase
      .select({ projectId: builds.projectId })
      .from(builds)
      .where(eq(builds.id, buildId))
      .limit(1);

    return build?.projectId ?? null;
  }

  listCanonicalAncestorIds(reportId: string): Promise<readonly string[]> {
    return listCanonicalAncestors(this.transactionDatabase, reportId);
  }

  listRelatedReporterDiscordUserIds(
    canonicalReportId: string,
  ): Promise<readonly string[]> {
    return listRelatedReporterDiscordUserIds(this.transactionDatabase, canonicalReportId);
  }

  async findLatestDuplicateHistoryEvent(
    reportId: string,
  ): ReturnType<ReportTransaction["findLatestDuplicateHistoryEvent"]> {
    const [event] = await this.transactionDatabase
      .select({ eventType: statusEvents.eventType, metadata: statusEvents.metadata })
      .from(statusEvents)
      .where(
        and(
          eq(statusEvents.reportId, reportId),
          inArray(statusEvents.eventType, ["duplicate_merged", "duplicate_unmerged"]),
        ),
      )
      .orderBy(desc(statusEvents.createdAt), desc(statusEvents.id))
      .limit(1);

    if (!event) {
      return null;
    }

    return {
      eventType: event.eventType as "duplicate_merged" | "duplicate_unmerged",
      metadata: event.metadata ?? null,
    };
  }

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

  async addStatusEvent(
    input: Parameters<ReportTransaction["addStatusEvent"]>[0],
  ): Promise<string> {
    const [event] = await this.transactionDatabase
      .insert(statusEvents)
      .values({
        reportId: input.reportId,
        eventType: input.eventType,
        fromStatus: input.fromStatus,
        toStatus: input.toStatus,
        actorUserId: input.actorId,
        note: input.note,
        metadata: input.metadata,
      })
      .returning({ id: statusEvents.id });

    if (!event) {
      throw new Error("Failed to create the report status event.");
    }

    return event.id;
  }

  async addNotifications(
    input: Parameters<ReportTransaction["addNotifications"]>[0],
  ): Promise<readonly string[]> {
    if (input.recipientDiscordUserIds.length === 0) {
      return [];
    }
    if (!this.notificationJobEnqueuer) {
      throw new Error("Notification job enqueuer is not configured.");
    }

    const created = await this.transactionDatabase
      .insert(notifications)
      .values(
        input.recipientDiscordUserIds.map((recipientDiscordUserId) => ({
          reportId: input.reportId,
          statusEventId: input.statusEventId,
          recipientDiscordUserId,
          type: input.type,
          idempotencyKey: `${input.statusEventId}:${input.type}:${recipientDiscordUserId}`,
        })),
      )
      .returning({ id: notifications.id });

    for (const notification of created) {
      await this.notificationJobEnqueuer(this.transactionDatabase, {
        jobName: "notification.send.v1",
        version: 1,
        notificationId: notification.id,
      });
    }

    return created.map((notification) => notification.id);
  }
}

export class DrizzleReportRepository implements ReportRepository {
  constructor(
    private readonly database: Database,
    private readonly notificationJobEnqueuer?: NotificationJobEnqueuer,
  ) {}

  async findById(reportId: string): Promise<ReportSnapshot | null> {
    return findReportById(this.database, reportId);
  }

  async listCanonicalAncestorIds(reportId: string): Promise<readonly string[]> {
    return listCanonicalAncestors(this.database, reportId);
  }

  async listRelatedReporterDiscordUserIds(
    canonicalReportId: string,
  ): Promise<readonly string[]> {
    return listRelatedReporterDiscordUserIds(this.database, canonicalReportId);
  }

  transaction<TResult>(
    work: (transaction: ReportTransaction) => Promise<TResult>,
  ): Promise<TResult> {
    return this.database.transaction((transactionDatabase) =>
      work(
        new DrizzleReportTransaction(transactionDatabase, this.notificationJobEnqueuer),
      ),
    );
  }
}
