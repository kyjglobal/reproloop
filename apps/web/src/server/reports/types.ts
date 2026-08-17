import type { ReportListItem, ReportListQuery } from "@reproloop/shared";

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
