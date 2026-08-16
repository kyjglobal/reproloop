import { primaryKey, pgTable, timestamp, uuid } from "drizzle-orm/pg-core";

import { organizationRole } from "./common.js";
import { discordGuilds } from "./discord-guilds.js";
import { organizations } from "./organizations.js";
import { users } from "./users.js";

export const organizationMembers = pgTable(
  "organization_members",
  {
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: organizationRole("role").notNull(),
    verifiedViaGuildId: uuid("verified_via_guild_id").references(() => discordGuilds.id, {
      onDelete: "set null",
    }),
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [primaryKey({ columns: [table.organizationId, table.userId] })],
);
