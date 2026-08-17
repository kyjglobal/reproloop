import type { ReportListQuery } from "@reproloop/shared";

import type { AuthGuards } from "../auth/types";
import type { ReportListPage, ReportListQueryRepository } from "./types";

export async function listAccessibleProjectReports(
  guards: AuthGuards,
  repository: ReportListQueryRepository,
  projectId: string,
  query: ReportListQuery,
): Promise<ReportListPage> {
  await guards.requireProjectMember(projectId);
  return repository.listProjectReports({ projectId, query });
}
