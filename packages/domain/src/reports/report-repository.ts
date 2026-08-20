import type { ReportStatus, StatusEventType } from "@reproloop/shared";

import type { DuplicateHistoryEvent, ReportSnapshot } from "./types.js";

export interface ReportTransaction {
  findById(reportId: string): Promise<ReportSnapshot | null>;
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
  }): Promise<void>;
}

export interface ReportRepository {
  findById(reportId: string): Promise<ReportSnapshot | null>;
  listCanonicalAncestorIds(reportId: string): Promise<readonly string[]>;
  listRelatedReporterDiscordUserIds(canonicalReportId: string): Promise<readonly string[]>;
  transaction<TResult>(work: (transaction: ReportTransaction) => Promise<TResult>): Promise<TResult>;
}
