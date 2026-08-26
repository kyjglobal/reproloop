import { DrizzleReportRepository } from "@reproloop/db";
import type { ReportRepository } from "@reproloop/domain";

import { getAuthGuards } from "../auth/runtime";
import { getDatabase } from "../db/connection";
import { enqueueNotificationJob } from "../jobs/notification-queue";
import { DrizzleReportDetailQueryRepository } from "./drizzle-report-detail-query-repository";
import { DrizzleDuplicateCandidateQueryRepository } from "./drizzle-duplicate-candidate-query-repository";
import { DrizzleReportListQueryRepository } from "./drizzle-report-list-query-repository";

let listRepository: DrizzleReportListQueryRepository | undefined;
let detailRepository: DrizzleReportDetailQueryRepository | undefined;
let transitionRepository: DrizzleReportRepository | undefined;
let duplicateCandidateRepository: DrizzleDuplicateCandidateQueryRepository | undefined;

function getTransitionRepository(): DrizzleReportRepository {
  transitionRepository ??= new DrizzleReportRepository(
    getDatabase(),
    enqueueNotificationJob,
  );
  return transitionRepository;
}

const lazyTransitionRepository: ReportRepository = {
  findById: (reportId) => getTransitionRepository().findById(reportId),
  listCanonicalAncestorIds: (reportId) =>
    getTransitionRepository().listCanonicalAncestorIds(reportId),
  listRelatedReportReporters: (reportId) =>
    getTransitionRepository().listRelatedReportReporters(reportId),
  transaction: (work) => getTransitionRepository().transaction(work),
};

export function getReportListQueryRepository(): DrizzleReportListQueryRepository {
  listRepository ??= new DrizzleReportListQueryRepository(getDatabase());
  return listRepository;
}

export function getReportDetailQueryRepository(): DrizzleReportDetailQueryRepository {
  detailRepository ??= new DrizzleReportDetailQueryRepository(getDatabase());
  return detailRepository;
}

export function getReportTransitionDependencies() {
  return {
    guards: getAuthGuards(),
    reportRepository: lazyTransitionRepository,
  };
}

export function getDuplicateCandidateQueryRepository(): DrizzleDuplicateCandidateQueryRepository {
  duplicateCandidateRepository ??= new DrizzleDuplicateCandidateQueryRepository(getDatabase());
  return duplicateCandidateRepository;
}
