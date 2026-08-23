import type {
  ReportDetail,
  ReportListItem,
  ReportListQuery,
  ReportTransition,
  ReportTransitionResult,
} from "@reproloop/shared";
import type { ReportRepository } from "@reproloop/domain";

import type { AuthGuards } from "../auth/types";

export interface ReportListPage {
  items: ReportListItem[];
  nextCursor: string | null;
}

export interface ReportListQueryRepository {
  listProjectReports(input: {
    projectId: string;
    query: ReportListQuery;
  }): Promise<ReportListPage>;
}

export interface ReportDetailQueryRepository {
  findReportProjectId(reportId: string): Promise<string | null>;
  findReportDetail(reportId: string): Promise<ReportDetail | null>;
}

export interface ReportTransitionDependencies {
  guards: AuthGuards;
  reportRepository: ReportRepository;
}

export type ReportStatusTransition = Exclude<
  ReportTransition,
  { action: "merge_duplicate" | "unmerge_duplicate" | "mark_fixed" }
>;

export type ReportTransitionHandler = (
  dependencies: ReportTransitionDependencies,
  reportId: string,
  transition: ReportTransition,
) => Promise<ReportTransitionResult>;
