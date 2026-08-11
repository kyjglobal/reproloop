import { ReportDomainError } from "../errors.js";
import { canRolePerformReportAction } from "./state-transition.js";
import type {
  DuplicateMergeDecision,
  DuplicateMergeInput,
  DuplicateUnmergeDecision,
  DuplicateUnmergeInput,
  MergeableReportStatus,
} from "./types.js";

const MERGEABLE_STATUSES = [
  "new",
  "needs_info",
  "investigating",
  "reproduced",
] as const satisfies readonly MergeableReportStatus[];

export function validateDuplicateMerge(input: DuplicateMergeInput): DuplicateMergeDecision {
  const { target, canonical, actorRole, expectedVersion, canonicalAncestorIds = [] } = input;

  if (target.deletedAt || canonical.deletedAt) {
    throw new ReportDomainError("NOT_FOUND", "제보를 찾을 수 없습니다.");
  }

  if (target.version !== expectedVersion) {
    throw new ReportDomainError("CONFLICT", "다른 사용자가 먼저 제보를 수정했습니다.");
  }

  if (!canRolePerformReportAction(actorRole, "merge_duplicate")) {
    throw new ReportDomainError("FORBIDDEN", "중복 병합 권한이 없습니다.");
  }

  if (target.projectId !== canonical.projectId) {
    throw new ReportDomainError("NOT_FOUND", "대표 제보를 찾을 수 없습니다.");
  }

  if (target.id === canonical.id) {
    throw new ReportDomainError("VALIDATION_ERROR", "자기 자신을 대표 제보로 지정할 수 없습니다.", {
      canonicalReportId: ["자기 자신을 대표 제보로 지정할 수 없습니다."],
    });
  }

  if (!MERGEABLE_STATUSES.includes(target.status as MergeableReportStatus)) {
    throw new ReportDomainError(
      "INVALID_STATUS_TRANSITION",
      "현재 상태의 제보는 중복 병합할 수 없습니다.",
    );
  }

  if (canonical.status === "duplicate" || canonical.canonicalReportId) {
    throw new ReportDomainError("CONFLICT", "중복 제보를 대표 제보로 지정할 수 없습니다.");
  }

  if (canonicalAncestorIds.includes(target.id)) {
    throw new ReportDomainError("CONFLICT", "중복 제보 관계에 순환이 생길 수 없습니다.");
  }

  return {
    previousStatus: target.status as MergeableReportStatus,
    nextStatus: "duplicate",
    canonicalReportId: canonical.id,
    eventType: "duplicate_merged",
    nextVersion: target.version + 1,
  };
}

export function validateDuplicateUnmerge(input: DuplicateUnmergeInput): DuplicateUnmergeDecision {
  const { target, actorRole, expectedVersion, previousStatusBeforeDuplicate } = input;

  if (target.deletedAt) {
    throw new ReportDomainError("NOT_FOUND", "제보를 찾을 수 없습니다.");
  }

  if (target.version !== expectedVersion) {
    throw new ReportDomainError("CONFLICT", "다른 사용자가 먼저 제보를 수정했습니다.");
  }

  if (!canRolePerformReportAction(actorRole, "unmerge_duplicate")) {
    throw new ReportDomainError("FORBIDDEN", "중복 병합 취소 권한이 없습니다.");
  }

  if (target.status !== "duplicate" || !target.canonicalReportId) {
    throw new ReportDomainError(
      "INVALID_STATUS_TRANSITION",
      "중복 제보만 병합을 취소할 수 있습니다.",
    );
  }

  if (!previousStatusBeforeDuplicate) {
    throw new ReportDomainError("CONFLICT", "병합 직전 상태를 복원할 수 없습니다.");
  }

  return {
    previousStatus: "duplicate",
    nextStatus: previousStatusBeforeDuplicate,
    canonicalReportId: null,
    eventType: "duplicate_unmerged",
    nextVersion: target.version + 1,
  };
}
