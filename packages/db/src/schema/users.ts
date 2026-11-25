import { pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

export const users = pgTable(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    discordUserId: text("discord_user_id").notNull(),
    localUsername: text("local_username"),
    passwordHash: text("password_hash"),
    email: text("email"),
    displayName: text("display_name").notNull(),
    avatarUrl: text("avatar_url"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("users_discord_user_id_uidx").on(table.discordUserId),
    uniqueIndex("users_local_username_uidx").on(table.localUsername),
  ],
);
