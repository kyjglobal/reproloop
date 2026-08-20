import type { ReportDetail, ReportListQuery } from "@reproloop/shared";

import { ApiRequestError } from "../api/errors";
import type { AuthGuards } from "../auth/types";
import type {
  ReportDetailQueryRepository,
  ReportListPage,
  ReportListQueryRepository,
} from "./types";

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
