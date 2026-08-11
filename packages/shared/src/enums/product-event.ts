import { z } from "zod";

export const PRODUCT_EVENT_TYPES = [
  "bug_command_started",
  "bug_report_submitted",
  "report_viewed",
  "report_status_changed",
  "duplicate_merged",
  "fix_notification_sent",
] as const;

export const ProductEventTypeSchema = z.enum(PRODUCT_EVENT_TYPES);

export type ProductEventType = z.infer<typeof ProductEventTypeSchema>;
