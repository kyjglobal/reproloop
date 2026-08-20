import type { ReportDetail, ReportListItem, ReportListQuery } from "@reproloop/shared";

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
