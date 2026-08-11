import type {
  OrganizationRole,
  ReportStatus,
  ReportTransitionAction,
  StatusEventType,
} from "@reproloop/shared";

import { ReportDomainError } from "../errors.js";
import type { ReportTransitionDecision, ReportTransitionInput } from "./types.js";

export const ALLOWED_REPORT_TRANSITIONS = {
  new: ["request_information", "start_investigation", "mark_reproduced", "merge_duplicate"],
  needs_info: ["start_investigation", "merge_duplicate"],
  investigating: ["request_information", "mark_reproduced", "merge_duplicate"],
  reproduced: ["mark_fixed", "merge_duplicate"],
  fixed: [],
  duplicate: ["unmerge_duplicate"],
} as const satisfies Record<ReportStatus, readonly ReportTransitionAction[]>;

const MEMBER_ACTIONS = [
  "request_information",
  "start_investigation",
  "mark_reproduced",
] as const satisfies readonly ReportTransitionAction[];

const TRANSITION_RESULTS: Partial<
  Record<ReportTransitionAction, { nextStatus: ReportStatus; eventType: StatusEventType }>
> = {
  request_information: { nextStatus: "needs_info", eventType: "information_requested" },
  start_investigation: { nextStatus: "investigating", eventType: "investigation_started" },
  mark_reproduced: { nextStatus: "reproduced", eventType: "report_reproduced" },
  merge_duplicate: { nextStatus: "duplicate", eventType: "duplicate_merged" },
  mark_fixed: { nextStatus: "fixed", eventType: "report_fixed" },
  unmerge_duplicate: { nextStatus: "new", eventType: "duplicate_unmerged" },
};

export function getAllowedReportTransitionActions(
  status: ReportStatus,
): readonly ReportTransitionAction[] {
  return ALLOWED_REPORT_TRANSITIONS[status];
}

export function canRolePerformReportAction(
  role: OrganizationRole,
  action: ReportTransitionAction,
): boolean {
  return role === "owner" || role === "admin" || MEMBER_ACTIONS.includes(action as never);
}

export function validateReportTransition(input: ReportTransitionInput): ReportTransitionDecision {
  const { report, transition, actorRole } = input;

  if (report.deletedAt) {
    throw new ReportDomainError("NOT_FOUND", "제보를 찾을 수 없습니다.");
  }

  if (report.version !== transition.expectedVersion) {
    throw new ReportDomainError("CONFLICT", "다른 사용자가 먼저 제보를 수정했습니다.");
  }

  if (!canRolePerformReportAction(actorRole, transition.action)) {
    throw new ReportDomainError("FORBIDDEN", "요청한 상태 변경 권한이 없습니다.");
  }

  const allowed = getAllowedReportTransitionActions(report.status);
  if (!allowed.includes(transition.action as never)) {
    throw new ReportDomainError(
      "INVALID_STATUS_TRANSITION",
      "현재 상태에서는 요청한 상태로 변경할 수 없습니다.",
    );
  }

  if (transition.action === "mark_fixed" && input.fixedBuildProjectId !== report.projectId) {
    throw new ReportDomainError("NOT_FOUND", "수정 빌드를 찾을 수 없습니다.");
  }

  const result = TRANSITION_RESULTS[transition.action];
  if (!result) {
    throw new ReportDomainError("INVALID_STATUS_TRANSITION", "지원하지 않는 상태 변경입니다.");
  }

  const nextStatus =
    transition.action === "unmerge_duplicate"
      ? input.previousStatusBeforeDuplicate
      : result.nextStatus;

  if (!nextStatus) {
    throw new ReportDomainError("CONFLICT", "병합 직전 상태를 복원할 수 없습니다.");
  }

  return {
    action: transition.action,
    previousStatus: report.status,
    nextStatus,
    eventType: result.eventType,
    nextVersion: report.version + 1,
    fixedBuildId: transition.action === "mark_fixed" ? transition.fixedBuildId : report.fixedBuildId,
    createsNotification:
      transition.action === "request_information" || transition.action === "mark_fixed",
  };
}
