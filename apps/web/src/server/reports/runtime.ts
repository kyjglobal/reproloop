import { getDatabase } from "../db/connection";
import { DrizzleReportDetailQueryRepository } from "./drizzle-report-detail-query-repository";
import { DrizzleReportListQueryRepository } from "./drizzle-report-list-query-repository";

let listRepository: DrizzleReportListQueryRepository | undefined;
let detailRepository: DrizzleReportDetailQueryRepository | undefined;

export function getReportListQueryRepository(): DrizzleReportListQueryRepository {
  listRepository ??= new DrizzleReportListQueryRepository(getDatabase());
  return listRepository;
}

export function getReportDetailQueryRepository(): DrizzleReportDetailQueryRepository {
  detailRepository ??= new DrizzleReportDetailQueryRepository(getDatabase());
  return detailRepository;
}
