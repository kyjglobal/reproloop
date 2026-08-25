import type {
  DuplicateCandidate,
  DuplicateCandidateQuery,
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

export type ReportFixedTransition = Extract<ReportTransition, { action: "mark_fixed" }>;

export type ReportDuplicateTransition = Extract<
  ReportTransition,
  { action: "merge_duplicate" | "unmerge_duplicate" }
>;

export type ReportTransitionHandler = (
  dependencies: ReportTransitionDependencies,
  reportId: string,
  transition: ReportTransition,
) => Promise<ReportTransitionResult>;

export interface DuplicateCandidateQueryRepository {
  findCandidateTargetProjectId(targetReportId: string): Promise<string | null>;
  listDuplicateCandidates(input: {
    projectId: string;
    targetReportId: string;
    query: DuplicateCandidateQuery;
  }): Promise<DuplicateCandidate[]>;
}
