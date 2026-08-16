import { index, integer, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

import { bugReports } from "./bug-reports.js";
import { notificationStatus, notificationType } from "./common.js";
import { statusEvents } from "./status-events.js";

export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    reportId: uuid("report_id")
      .notNull()
      .references(() => bugReports.id, { onDelete: "cascade" }),
    statusEventId: uuid("status_event_id")
      .notNull()
      .references(() => statusEvents.id, { onDelete: "cascade" }),
    recipientDiscordUserId: text("recipient_discord_user_id").notNull(),
    type: notificationType("type").notNull(),
    status: notificationStatus("status").default("queued").notNull(),
    idempotencyKey: text("idempotency_key").notNull(),
    attemptCount: integer("attempt_count").default(0).notNull(),
    lastErrorCode: text("last_error_code"),
    lastErrorMessage: text("last_error_message"),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("notifications_idempotency_key_uidx").on(table.idempotencyKey),
    index("notifications_status_created_at_idx").on(table.status, table.createdAt),
    index("notifications_report_id_idx").on(table.reportId),
  ],
);
