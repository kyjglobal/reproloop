import { bigint, index, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

import { bugReports } from "./bug-reports.js";

export const attachments = pgTable(
  "attachments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    reportId: uuid("report_id")
      .notNull()
      .references(() => bugReports.id, { onDelete: "cascade" }),
    storagePath: text("storage_path").notNull(),
    originalFilename: text("original_filename").notNull(),
    contentType: text("content_type").notNull(),
    sizeBytes: bigint("size_bytes", { mode: "number" }).notNull(),
    sha256: text("sha256").notNull(),
    sanitizationVersion: text("sanitization_version"),
    sanitizedAt: timestamp("sanitized_at", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("attachments_storage_path_uidx").on(table.storagePath),
    index("attachments_report_id_idx").on(table.reportId),
    index("attachments_expires_at_idx").on(table.expiresAt),
  ],
);
