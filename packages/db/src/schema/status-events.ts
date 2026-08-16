import { index, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { bugReports } from "./bug-reports.js";
import { reportStatus, statusEventType } from "./common.js";
import { users } from "./users.js";

export const statusEvents = pgTable(
  "status_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    reportId: uuid("report_id")
      .notNull()
      .references(() => bugReports.id, { onDelete: "cascade" }),
    eventType: statusEventType("event_type").notNull(),
    fromStatus: reportStatus("from_status"),
    toStatus: reportStatus("to_status").notNull(),
    actorUserId: uuid("actor_user_id").references(() => users.id, { onDelete: "set null" }),
    note: text("note"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("status_events_report_created_at_idx").on(table.reportId, table.createdAt)],
);
