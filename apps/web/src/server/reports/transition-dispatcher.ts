import type { ReportTransition } from "@reproloop/shared";

import { ApiRequestError } from "../api/errors";
import {
  transitionDuplicateReport,
  transitionReportFixed,
  transitionReportStatus,
} from "./service";
import type {
  ReportDuplicateTransition,
  ReportStatusTransition,
  ReportTransitionDependencies,
  ReportTransitionHandler,
} from "./types";

const STATUS_ACTIONS = new Set<ReportTransition["action"]>([
  "request_information",
  "start_investigation",
  "mark_reproduced",
]);

function isStatusTransition(transition: ReportTransition): transition is ReportStatusTransition {
  return STATUS_ACTIONS.has(transition.action);
}

function isDuplicateTransition(
  transition: ReportTransition,
): transition is ReportDuplicateTransition {
  return transition.action === "merge_duplicate" || transition.action === "unmerge_duplicate";
}

export const handleStatusTransition: ReportTransitionHandler = (
  dependencies,
  reportId,
  transition,
) => {
  if (!isStatusTransition(transition)) {
    throw new ApiRequestError(
      "INVALID_STATUS_TRANSITION",
      "이 상태 변경은 아직 연결되지 않았습니다.",
    );
  }

  return transitionReportStatus(dependencies, reportId, transition);
};

export const handleDuplicateTransition: ReportTransitionHandler = (
  dependencies,
  reportId,
  transition,
) => {
  if (!isDuplicateTransition(transition)) {
    throw new ApiRequestError(
      "INVALID_STATUS_TRANSITION",
      "중복 병합 또는 병합 취소 요청이 필요합니다.",
    );
  }

  return transitionDuplicateReport(dependencies, reportId, transition);
};

export async function dispatchReportTransition(
  dependencies: ReportTransitionDependencies,
  reportId: string,
  transition: ReportTransition,
) {
  switch (transition.action) {
    case "request_information":
    case "start_investigation":
    case "mark_reproduced":
      return handleStatusTransition(dependencies, reportId, transition);
    case "merge_duplicate":
    case "unmerge_duplicate":
      return handleDuplicateTransition(dependencies, reportId, transition);
    case "mark_fixed":
      return transitionReportFixed(dependencies, reportId, transition);
  }
}
