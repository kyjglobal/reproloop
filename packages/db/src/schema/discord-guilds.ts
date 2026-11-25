import { pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

import { organizations } from "./organizations.js";
import { users } from "./users.js";

export const discordGuilds = pgTable(
  "discord_guilds",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    discordGuildId: text("discord_guild_id").notNull(),
    name: text("name").notNull(),
    bridgeInstallationId: uuid("bridge_installation_id"),
    bridgeToken: text("bridge_token"),
    bridgeLastSeenAt: timestamp("bridge_last_seen_at", { withTimezone: true }),
    bugChannelId: text("bug_channel_id"),
    installedByUserId: uuid("installed_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    installedAt: timestamp("installed_at", { withTimezone: true }).defaultNow().notNull(),
    removedAt: timestamp("removed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [uniqueIndex("discord_guilds_discord_guild_id_uidx").on(table.discordGuildId)],
);
