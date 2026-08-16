import { index, jsonb, pgTable, timestamp, uuid } from "drizzle-orm/pg-core";

import { bugReports } from "./bug-reports.js";
import { productEventType } from "./common.js";
import { gameProjects } from "./game-projects.js";
import { users } from "./users.js";

export const productEvents = pgTable(
  "product_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    eventType: productEventType("event_type").notNull(),
    projectId: uuid("project_id").references(() => gameProjects.id, { onDelete: "cascade" }),
    reportId: uuid("report_id").references(() => bugReports.id, { onDelete: "set null" }),
    actorUserId: uuid("actor_user_id").references(() => users.id, { onDelete: "set null" }),
    properties: jsonb("properties").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("product_events_type_created_at_idx").on(table.eventType, table.createdAt),
    index("product_events_project_created_at_idx").on(table.projectId, table.createdAt),
  ],
);
