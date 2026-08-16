import { index, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

import { discordGuilds } from "./discord-guilds.js";
import { organizations } from "./organizations.js";

export const gameProjects = pgTable(
  "game_projects",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    discordGuildId: uuid("discord_guild_id")
      .notNull()
      .references(() => discordGuilds.id),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    defaultLocale: text("default_locale").default("ko").notNull(),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("game_projects_organization_slug_uidx").on(table.organizationId, table.slug),
    index("game_projects_discord_guild_id_idx").on(table.discordGuildId),
  ],
);
