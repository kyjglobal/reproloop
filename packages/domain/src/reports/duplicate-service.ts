import type { OrganizationRole } from "@reproloop/shared";

import { ReportDomainError } from "../errors.js";
import { validateDuplicateMerge, validateDuplicateUnmerge } from "./duplicate-merge.js";
import type { ReportRepository } from "./report-repository.js";
import type { DuplicateMutationResult, MergeableReportStatus } from "./types.js";

const MERGEABLE_STATUSES = new Set<MergeableReportStatus>([
  "new",
  "needs_info",
  "investigating",
  "reproduced",
]);

export interface MergeDuplicateCommand {
  targetReportId: string;
  canonicalReportId: string;
  actorId: string;
  actorRole: OrganizationRole;
  expectedVersion: number;
  note?: string;
}

export interface UnmergeDuplicateCommand {
  targetReportId: string;
  actorId: string;
  actorRole: OrganizationRole;
  expectedVersion: number;
  note?: string;
}

export async function mergeDuplicateReport(
  repository: ReportRepository,
  command: MergeDuplicateCommand,
): Promise<DuplicateMutationResult> {
  return repository.transaction(async (transaction) => {
    const target = await transaction.findById(command.targetReportId);
    const canonical = await transaction.findById(command.canonicalReportId);

    if (!target) {
      throw new ReportDomainError("NOT_FOUND", "제보를 찾을 수 없습니다.");
    }
    if (!canonical) {
      throw new ReportDomainError("NOT_FOUND", "대표 제보를 찾을 수 없습니다.");
    }

    const canonicalAncestorIds = await transaction.listCanonicalAncestorIds(canonical.id);
    const decision = validateDuplicateMerge({
      target,
      canonical,
      actorRole: command.actorRole,
      expectedVersion: command.expectedVersion,
      canonicalAncestorIds,
    });

    await transaction.updateReport({
      reportId: target.id,
      expectedVersion: command.expectedVersion,
      status: decision.nextStatus,
      canonicalReportId: decision.canonicalReportId,
    });
    await transaction.addStatusEvent({
      reportId: target.id,
      eventType: decision.eventType,
      fromStatus: decision.previousStatus,
      toStatus: decision.nextStatus,
      actorId: command.actorId,
      note: command.note,
      metadata: {
        previousStatus: decision.previousStatus,
        canonicalReportId: decision.canonicalReportId,
      },
    });

    return {
      reportId: target.id,
      previousStatus: decision.previousStatus,
      nextStatus: decision.nextStatus,
      canonicalReportId: decision.canonicalReportId,
      version: decision.nextVersion,
    };
  });
}

export async function unmergeDuplicateReport(
  repository: ReportRepository,
  command: UnmergeDuplicateCommand,
): Promise<DuplicateMutationResult> {
  return repository.transaction(async (transaction) => {
    const target = await transaction.findById(command.targetReportId);
    if (!target) {
      throw new ReportDomainError("NOT_FOUND", "제보를 찾을 수 없습니다.");
    }

    const latestHistory = await transaction.findLatestDuplicateHistoryEvent(target.id);
    const recordedPreviousStatus = latestHistory?.metadata?.previousStatus;
    const previousStatusBeforeDuplicate =
      latestHistory?.eventType === "duplicate_merged" &&
      typeof recordedPreviousStatus === "string" &&
      MERGEABLE_STATUSES.has(recordedPreviousStatus as MergeableReportStatus)
        ? (recordedPreviousStatus as MergeableReportStatus)
        : null;

    const decision = validateDuplicateUnmerge({
      target,
      actorRole: command.actorRole,
      expectedVersion: command.expectedVersion,
      previousStatusBeforeDuplicate,
    });
    const previousCanonicalReportId = target.canonicalReportId;

    await transaction.updateReport({
      reportId: target.id,
      expectedVersion: command.expectedVersion,
      status: decision.nextStatus,
      canonicalReportId: decision.canonicalReportId,
    });
    await transaction.addStatusEvent({
      reportId: target.id,
      eventType: decision.eventType,
      fromStatus: decision.previousStatus,
      toStatus: decision.nextStatus,
      actorId: command.actorId,
      note: command.note,
      metadata: {
        restoredStatus: decision.nextStatus,
        previousCanonicalReportId,
      },
    });

    return {
      reportId: target.id,
      previousStatus: decision.previousStatus,
      nextStatus: decision.nextStatus,
      canonicalReportId: decision.canonicalReportId,
      version: decision.nextVersion,
    };
  });
}
