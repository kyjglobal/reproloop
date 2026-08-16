import { boolean, index, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

import { gameProjects } from "./game-projects.js";

export const builds = pgTable(
  "builds",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => gameProjects.id, { onDelete: "cascade" }),
    version: text("version").notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    releasedAt: timestamp("released_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("builds_project_version_uidx").on(table.projectId, table.version),
    index("builds_project_active_idx").on(table.projectId, table.isActive),
  ],
);
