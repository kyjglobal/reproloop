import { validateReportTransition } from "@reproloop/domain";
import type {
  DuplicateCandidate,
  DuplicateCandidateQuery,
  ReportDetail,
  ReportListQuery,
  ReportTransitionResult,
} from "@reproloop/shared";

import { ApiRequestError } from "../api/errors";
import type { AuthGuards } from "../auth/types";
import type {
  DuplicateCandidateQueryRepository,
  ReportDetailQueryRepository,
  ReportListPage,
  ReportListQueryRepository,
  ReportStatusTransition,
  ReportTransitionDependencies,
} from "./types";

export async function listAccessibleDuplicateCandidates(
  guards: AuthGuards,
  repository: DuplicateCandidateQueryRepository,
  projectId: string,
  targetReportId: string,
  query: DuplicateCandidateQuery,
): Promise<DuplicateCandidate[]> {
  const targetProjectId = await repository.findCandidateTargetProjectId(targetReportId);
  if (!targetProjectId || targetProjectId !== projectId) {
    throw new ApiRequestError("NOT_FOUND", "제보를 찾을 수 없습니다.");
  }

  await guards.requireProjectMember(projectId);
  return repository.listDuplicateCandidates({ projectId, targetReportId, query });
}

export async function listAccessibleProjectReports(
  guards: AuthGuards,
  repository: ReportListQueryRepository,
  projectId: string,
  query: ReportListQuery,
): Promise<ReportListPage> {
  await guards.requireProjectMember(projectId);
  return repository.listProjectReports({ projectId, query });
}

export async function getAccessibleReportDetail(
  guards: AuthGuards,
  repository: ReportDetailQueryRepository,
  reportId: string,
  expectedProjectId?: string,
): Promise<ReportDetail> {
  const projectId = await repository.findReportProjectId(reportId);

  if (!projectId || (expectedProjectId && projectId !== expectedProjectId)) {
    throw new ApiRequestError("NOT_FOUND", "제보를 찾을 수 없습니다.");
  }

  await guards.requireProjectMember(projectId);
  const detail = await repository.findReportDetail(reportId);

  if (!detail || detail.projectId !== projectId) {
    throw new ApiRequestError("NOT_FOUND", "제보를 찾을 수 없습니다.");
  }

  return detail;
}

function getTransitionNote(transition: ReportStatusTransition): string | undefined {
  if (transition.action === "request_information") {
    return transition.message;
  }

  return transition.note;
}

export async function transitionReportStatus(
  dependencies: ReportTransitionDependencies,
  reportId: string,
  transition: ReportStatusTransition,
): Promise<ReportTransitionResult> {
  const report = await dependencies.reportRepository.findById(reportId);
  if (!report) {
    throw new ApiRequestError("NOT_FOUND", "제보를 찾을 수 없습니다.");
  }

  const membership = await dependencies.guards.requireProjectMember(report.projectId);
  const decision = validateReportTransition({
    report,
    actorRole: membership.role,
    transition,
  });

  await dependencies.reportRepository.transaction(async (transaction) => {
    await transaction.updateReport({
      reportId,
      expectedVersion: transition.expectedVersion,
      status: decision.nextStatus,
    });
    await transaction.addStatusEvent({
      reportId,
      eventType: decision.eventType,
      fromStatus: decision.previousStatus,
      toStatus: decision.nextStatus,
      actorId: membership.userId,
      note: getTransitionNote(transition),
    });
  });

  return {
    reportId,
    action: decision.action,
    previousStatus: decision.previousStatus,
    status: decision.nextStatus,
    version: decision.nextVersion,
  };
}
