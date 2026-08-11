import { z } from "zod";

export const NOTIFICATION_TYPES = ["information_requested", "report_fixed"] as const;
export const NOTIFICATION_STATUSES = ["queued", "processing", "sent", "failed"] as const;

export const NotificationTypeSchema = z.enum(NOTIFICATION_TYPES);
export const NotificationStatusSchema = z.enum(NOTIFICATION_STATUSES);

export type NotificationType = z.infer<typeof NotificationTypeSchema>;
export type NotificationStatus = z.infer<typeof NotificationStatusSchema>;
