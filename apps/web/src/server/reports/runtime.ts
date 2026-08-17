import { getDatabase } from "../db/connection";
import { DrizzleReportListQueryRepository } from "./drizzle-report-list-query-repository";

let repository: DrizzleReportListQueryRepository | undefined;

export function getReportListQueryRepository(): DrizzleReportListQueryRepository {
  repository ??= new DrizzleReportListQueryRepository(getDatabase());
  return repository;
}
