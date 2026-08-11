import { z } from "zod";

export const REPORT_STATUSES = [
  "new",
  "needs_info",
  "investigating",
  "reproduced",
  "fixed",
  "duplicate",
] as const;

export const REPORT_SEVERITIES = ["low", "medium", "high", "critical"] as const;

export const REPORT_TRANSITION_ACTIONS = [
  "request_information",
  "start_investigation",
  "mark_reproduced",
  "merge_duplicate",
  "mark_fixed",
  "unmerge_duplicate",
] as const;

export const STATUS_EVENT_TYPES = [
  "report_created",
  "information_requested",
  "investigation_started",
  "report_reproduced",
  "duplicate_merged",
  "duplicate_unmerged",
  "report_fixed",
] as const;

export const ReportStatusSchema = z.enum(REPORT_STATUSES);
export const ReportSeveritySchema = z.enum(REPORT_SEVERITIES);
export const ReportTransitionActionSchema = z.enum(REPORT_TRANSITION_ACTIONS);
export const StatusEventTypeSchema = z.enum(STATUS_EVENT_TYPES);

export type ReportStatus = z.infer<typeof ReportStatusSchema>;
export type ReportSeverity = z.infer<typeof ReportSeveritySchema>;
export type ReportTransitionAction = z.infer<typeof ReportTransitionActionSchema>;
export type StatusEventType = z.infer<typeof StatusEventTypeSchema>;
