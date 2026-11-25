import { setTimeout as delay } from "node:timers/promises";

import { DrizzleDiscordBugRepository } from "@reproloop/db";
import type { Database } from "@reproloop/db/client";
import { discordGuilds } from "@reproloop/db/schema";
import { BridgeTaskSchema, bridgeUrl, type BridgeOperation } from "@reproloop/shared";
import { and, eq, isNotNull, isNull } from "drizzle-orm";

async function applyOperation(
  repository: DrizzleDiscordBugRepository,
  guildId: string,
  operation: BridgeOperation,
) {
  if (guildId !== operation.input.discordGuildId) throw new Error("Discord server mismatch.");
  switch (operation.type) {
    case "projects": return repository.listProjectChoices(operation.input);
    case "builds": return repository.listBuildChoices(operation.input);
    case "selection": return repository.selectionExists(operation.input);
    case "create": return repository.createReport(operation.input, operation.receipt);
  }
}

export function startBotConnection(database: Database, brokerUrl: string, signal: AbortSignal) {
  const repository = new DrizzleDiscordBugRepository(database);
  const poll = bridgeUrl(brokerUrl, "poll");
  const reply = bridgeUrl(brokerUrl, "reply");
  return (async () => {
    while (!signal.aborted) {
      let pause = 1000;
      try {
        const [guild] = await database.select({
          id: discordGuilds.id, guildId: discordGuilds.discordGuildId, token: discordGuilds.bridgeToken,
        }).from(discordGuilds).where(and(isNull(discordGuilds.removedAt), isNotNull(discordGuilds.bridgeToken))).limit(1);
        if (guild?.token) {
          const headers = { authorization: `Bearer ${guild.token}`, "content-type": "application/json" };
          const response = await fetch(poll, {
            method: "POST", headers, redirect: "error",
            signal: AbortSignal.any([signal, AbortSignal.timeout(25_000)]),
          });
          if (response.ok) {
            const current = and(eq(discordGuilds.id, guild.id), eq(discordGuilds.bridgeToken, guild.token));
            await database.update(discordGuilds).set({ bridgeLastSeenAt: new Date() }).where(current);
            if (response.status !== 204) {
              const task = BridgeTaskSchema.parse(await response.json());
              let result: unknown;
              let failed = false;
              try {
                result = await applyOperation(repository, guild.guildId, task.operation);
              } catch {
                failed = true;
              }
              await fetch(reply, {
                method: "POST", headers, body: JSON.stringify({ id: task.id, result, failed }),
                redirect: "error",
                signal: AbortSignal.any([signal, AbortSignal.timeout(5000)]),
              });
            }
            pause = 0;
          }
        }
      } catch {
        pause = 2000;
      }
      if (pause > 0 && !signal.aborted) await delay(pause, undefined, { signal }).catch(() => {});
    }
  })();
}
