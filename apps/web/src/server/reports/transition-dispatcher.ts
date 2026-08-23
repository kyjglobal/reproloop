import type { ReportTransition } from "@reproloop/shared";

import { ApiRequestError } from "../api/errors";
import { transitionReportStatus } from "./service";
import type {
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
      throw new ApiRequestError(
        "INVALID_STATUS_TRANSITION",
        "중복 병합 기능은 B 담당 핸들러 연결 후 사용할 수 있습니다.",
      );
    case "mark_fixed":
      throw new ApiRequestError(
        "INVALID_STATUS_TRANSITION",
        "수정 완료와 알림 기능은 Day 8 구현 후 사용할 수 있습니다.",
      );
  }
}
