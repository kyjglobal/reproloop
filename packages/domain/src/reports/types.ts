import type {
  OrganizationRole,
  ReportStatus,
  ReportTransition,
  ReportTransitionAction,
  StatusEventType,
} from "@reproloop/shared";

export type MergeableReportStatus = Exclude<ReportStatus, "fixed" | "duplicate">;

export interface ReportSnapshot {
  id: string;
  projectId: string;
  status: ReportStatus;
  version: number;
  canonicalReportId: string | null;
  fixedBuildId: string | null;
  deletedAt: Date | null;
}

export interface ReportTransitionInput {
  report: ReportSnapshot;
  actorRole: OrganizationRole;
  transition: ReportTransition;
  fixedBuildProjectId?: string | null;
  previousStatusBeforeDuplicate?: MergeableReportStatus | null;
}

export interface ReportTransitionDecision {
  action: ReportTransitionAction;
  previousStatus: ReportStatus;
  nextStatus: ReportStatus;
  eventType: StatusEventType;
  nextVersion: number;
  fixedBuildId: string | null;
  createsNotification: boolean;
}

export interface DuplicateMergeInput {
  target: ReportSnapshot;
  canonical: ReportSnapshot;
  actorRole: OrganizationRole;
  expectedVersion: number;
  canonicalAncestorIds?: readonly string[];
}

export interface DuplicateMergeDecision {
  previousStatus: MergeableReportStatus;
  nextStatus: "duplicate";
  canonicalReportId: string;
  eventType: "duplicate_merged";
  nextVersion: number;
}

export interface DuplicateUnmergeInput {
  target: ReportSnapshot;
  actorRole: OrganizationRole;
  expectedVersion: number;
  previousStatusBeforeDuplicate: MergeableReportStatus | null;
}

export interface DuplicateUnmergeDecision {
  previousStatus: "duplicate";
  nextStatus: MergeableReportStatus;
  canonicalReportId: null;
  eventType: "duplicate_unmerged";
  nextVersion: number;
}
