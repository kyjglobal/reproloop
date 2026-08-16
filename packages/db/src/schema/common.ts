import { pgEnum } from "drizzle-orm/pg-core";

type OrganizationRoles = typeof import("@reproloop/shared").ORGANIZATION_ROLES;
type ReportStatuses = typeof import("@reproloop/shared").REPORT_STATUSES;
type ReportSeverities = typeof import("@reproloop/shared").REPORT_SEVERITIES;
type StatusEventTypes = typeof import("@reproloop/shared").STATUS_EVENT_TYPES;
type NotificationTypes = typeof import("@reproloop/shared").NOTIFICATION_TYPES;
type NotificationStatuses = typeof import("@reproloop/shared").NOTIFICATION_STATUSES;
type ProductEventTypes = typeof import("@reproloop/shared").PRODUCT_EVENT_TYPES;

const organizationRoleValues = ["owner", "admin", "member"] as const satisfies OrganizationRoles;
const reportStatusValues = [
  "new",
  "needs_info",
  "investigating",
  "reproduced",
  "fixed",
  "duplicate",
] as const satisfies ReportStatuses;
const reportSeverityValues = [
  "low",
  "medium",
  "high",
  "critical",
] as const satisfies ReportSeverities;
const statusEventTypeValues = [
  "report_created",
  "information_requested",
  "investigation_started",
  "report_reproduced",
  "duplicate_merged",
  "duplicate_unmerged",
  "report_fixed",
] as const satisfies StatusEventTypes;
const notificationTypeValues = [
  "information_requested",
  "report_fixed",
] as const satisfies NotificationTypes;
const notificationStatusValues = [
  "queued",
  "processing",
  "sent",
  "failed",
] as const satisfies NotificationStatuses;
const productEventTypeValues = [
  "bug_command_started",
  "bug_report_submitted",
  "report_viewed",
  "report_status_changed",
  "duplicate_merged",
  "fix_notification_sent",
] as const satisfies ProductEventTypes;

export const organizationRole = pgEnum("organization_role", organizationRoleValues);
export const reportStatus = pgEnum("report_status", reportStatusValues);
export const reportSeverity = pgEnum("report_severity", reportSeverityValues);
export const statusEventType = pgEnum("status_event_type", statusEventTypeValues);
export const notificationType = pgEnum("notification_type", notificationTypeValues);
export const notificationStatus = pgEnum("notification_status", notificationStatusValues);
export const productEventType = pgEnum("product_event_type", productEventTypeValues);
