"use server";

import { randomUUID } from "node:crypto";

import { builds, discordGuilds, gameProjects, organizationMembers, users } from "@reproloop/db/schema";
import { BridgePairSchema, bridgeUrl } from "@reproloop/shared";
import { and, eq, ne, sql } from "drizzle-orm";
import { redirect } from "next/navigation";
import { z } from "zod";

import { AccountSchema, createLocalMember } from "@/server/auth/local-accounts";
import { getAuthGuards } from "@/server/auth/runtime";
import { getDatabase } from "@/server/db/connection";

import { getLocalMembership, type settingsMessages } from "./data";

function finish(result: keyof typeof settingsMessages): never {
  redirect(`/settings?result=${result}`);
}

async function manager(ownerOnly = false) {
  const membership = await getLocalMembership();
  if (membership.role !== "owner" && (ownerOnly || membership.role !== "admin")) finish("permission");
  return membership;
}

export async function connectDiscord(form: FormData) {
  const { organizationId, userId } = await manager(true);
  const code = z.string().trim().regex(/^[\w-]{16}$/).safeParse(form.get("code"));
  if (!code.success) finish("code");
  const base = process.env.REPROLOOP_BROKER_URL;
  if (!base) finish("setup");
  const result = await getDatabase().transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${organizationId}))`);
    const [previous] = await tx.select().from(discordGuilds)
      .where(eq(discordGuilds.organizationId, organizationId)).limit(1);
    let response: Response;
    try {
      response = await fetch(bridgeUrl(base, "pair"), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code: code.data, expectedGuildId: previous?.discordGuildId }),
        redirect: "error",
        signal: AbortSignal.timeout(5000),
      });
    } catch {
      return "network";
    }
    if (!response.ok) return response.status < 500 ? "code" : "network";
    const paired = BridgePairSchema.safeParse(await response.json());
    if (!paired.success || (previous && previous.discordGuildId !== paired.data.guildId)) return "network";
    const { id, guildId, guildName, token } = paired.data;
    const values = {
      organizationId,
      discordGuildId: guildId,
      name: guildName,
      bridgeInstallationId: id,
      bridgeToken: token,
      bridgeLastSeenAt: null,
      removedAt: null,
      installedByUserId: userId,
      updatedAt: new Date(),
    };
    if (previous) await tx.update(discordGuilds).set(values).where(eq(discordGuilds.id, previous.id));
    else await tx.insert(discordGuilds).values(values);
    return "connected";
  });
  finish(result);
}

export async function disconnectDiscord() {
  const { organizationId } = await manager(true);
  const base = process.env.REPROLOOP_BROKER_URL;
  if (!base) finish("setup");
  const result = await getDatabase().transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${organizationId}))`);
    const [guild] = await tx.select().from(discordGuilds)
      .where(eq(discordGuilds.organizationId, organizationId)).limit(1);
    if (!guild?.bridgeToken) return "disconnected";
    try {
      const response = await fetch(bridgeUrl(base, "disconnect"), {
        method: "POST",
        headers: { authorization: `Bearer ${guild.bridgeToken}` },
        redirect: "error",
        signal: AbortSignal.timeout(5000),
      });
      if (!response.ok && response.status !== 401) return "network";
    } catch {
      return "network";
    }
    await tx.update(discordGuilds).set({
      bridgeToken: null, bridgeLastSeenAt: null, removedAt: new Date(), updatedAt: new Date(),
    }).where(eq(discordGuilds.id, guild.id));
    return "disconnected";
  });
  finish(result);
}

export async function addProject(form: FormData) {
  const { organizationId } = await manager();
  const name = z.string().trim().min(1).max(80).safeParse(form.get("name"));
  if (!name.success) finish("invalid");
  const db = getDatabase();
  const [guild] = await db.select({ id: discordGuilds.id, removedAt: discordGuilds.removedAt })
    .from(discordGuilds).where(eq(discordGuilds.organizationId, organizationId)).limit(1);
  if (!guild || guild.removedAt) finish("missingGuild");
  const slug = name.data.normalize("NFKC").toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, "") || randomUUID();
  const rows = await db.insert(gameProjects).values({
    name: name.data, slug, organizationId, discordGuildId: guild.id,
  }).onConflictDoNothing().returning({ id: gameProjects.id });
  finish(rows.length ? "saved" : "duplicate");
}

export async function addBuild(form: FormData) {
  await manager();
  const input = z.object({
    projectId: z.uuid(),
    version: z.string().trim().min(1).max(100),
  }).safeParse(Object.fromEntries(form));
  if (!input.success) finish("invalid");
  const membership = await getAuthGuards().requireProjectMember(input.data.projectId);
  if (membership.role === "member") finish("permission");
  const rows = await getDatabase().insert(builds).values(input.data)
    .onConflictDoNothing().returning({ id: builds.id });
  finish(rows.length ? "saved" : "duplicate");
}

export async function addTeamMember(form: FormData) {
  const { organizationId } = await manager(true);
  const input = AccountSchema.extend({ role: z.enum(["admin", "member"]) })
    .safeParse(Object.fromEntries(form));
  if (!input.success) finish("invalid");
  finish(await createLocalMember(organizationId, input.data) ? "saved" : "duplicate");
}

export async function updateTeamMember(form: FormData) {
  const { organizationId } = await manager(true);
  const input = z.object({ id: z.uuid(), role: z.enum(["admin", "member", "disabled"]) })
    .safeParse(Object.fromEntries(form));
  if (!input.success) finish("invalid");
  const { id, role } = input.data;
  const member = and(
    eq(organizationMembers.organizationId, organizationId),
    eq(organizationMembers.userId, id),
    ne(organizationMembers.role, "owner"),
  );
  if (role === "disabled") {
    await getDatabase().transaction(async (tx) => {
      const removed = await tx.delete(organizationMembers).where(member).returning();
      if (removed.length) await tx.update(users).set({ passwordHash: null }).where(eq(users.id, id));
    });
  } else {
    await getDatabase().update(organizationMembers).set({ role, updatedAt: new Date() }).where(member);
  }
  finish("saved");
}
