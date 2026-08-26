import type { NotificationType, ReportStatus, StatusEventType } from "@reproloop/shared";

import type {
  DuplicateHistoryEvent,
  RelatedReportReporter,
  ReportSnapshot,
} from "./types.js";

export interface ReportNotificationRecipientReader {
  findById(reportId: string): Promise<ReportSnapshot | null>;
  listRelatedReportReporters(
    canonicalReportId: string,
  ): Promise<readonly RelatedReportReporter[]>;
}

export interface ReportTransaction extends ReportNotificationRecipientReader {
  findBuildProjectId(buildId: string): Promise<string | null>;
  listCanonicalAncestorIds(reportId: string): Promise<readonly string[]>;
  findLatestDuplicateHistoryEvent(reportId: string): Promise<DuplicateHistoryEvent | null>;

  updateReport(input: {
    reportId: string;
    expectedVersion: number;
    status: ReportStatus;
    canonicalReportId?: string | null;
    fixedBuildId?: string | null;
    resolvedAt?: Date | null;
  }): Promise<void>;

  addStatusEvent(input: {
    reportId: string;
    eventType: StatusEventType;
    fromStatus: ReportStatus;
    toStatus: ReportStatus;
    actorId: string;
    note?: string;
    metadata?: Record<string, unknown>;
  }): Promise<string>;

  addNotifications(input: {
    reportId: string;
    statusEventId: string;
    type: NotificationType;
    recipientDiscordUserIds: readonly string[];
  }): Promise<readonly string[]>;
}

export interface ReportRepository extends ReportNotificationRecipientReader {
  listCanonicalAncestorIds(reportId: string): Promise<readonly string[]>;
  transaction<TResult>(work: (transaction: ReportTransaction) => Promise<TResult>): Promise<TResult>;
}
