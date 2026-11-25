import "dotenv/config";

import { createDatabase } from "@reproloop/db/client";
import { bridgeUrl, NotificationSendJobV1Schema } from "@reproloop/shared";
import { PgBoss } from "pg-boss";

import { DiscordBotClient } from "./discord-client.js";
import { DrizzleNotificationRepository } from "./drizzle-notification-repository.js";
import { processNotificationJob } from "./notification-service.js";
import { startBotConnection } from "./bot-connection.js";
import { processBridgeNotification } from "./bridge-notification.js";

const NOTIFICATION_QUEUE = "notification.send.v1";

function requiredEnvironmentVariable(name: "DATABASE_URL" | "DISCORD_BOT_TOKEN"): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is missing or empty.`);
  }
  return value;
}

async function main(): Promise<void> {
  const databaseUrl = requiredEnvironmentVariable("DATABASE_URL");
  const local = process.env.REPROLOOP_MODE === "local";
  const brokerUrl = process.env.REPROLOOP_BROKER_URL?.trim();
  if (local && brokerUrl) bridgeUrl(brokerUrl, "poll");
  const connection = createDatabase(databaseUrl, { maxConnections: 5 });
  const repository = new DrizzleNotificationRepository(connection.database);
  const discordClient = local ? null : new DiscordBotClient(requiredEnvironmentVariable("DISCORD_BOT_TOKEN"));
  const stopping = new AbortController();
  const boss = new PgBoss(databaseUrl);

  boss.on("error", (error) => console.error("pg-boss error", error));
  await boss.start();
  await boss.createQueue(NOTIFICATION_QUEUE);
  await boss.work(NOTIFICATION_QUEUE, async (jobs) => {
    for (const queueJob of jobs) {
      const job = NotificationSendJobV1Schema.parse(queueJob.data);
      if (discordClient) await processNotificationJob(repository, discordClient, job);
      else if (brokerUrl) await processBridgeNotification(connection.database, brokerUrl, job.notificationId);
      else throw new Error("REPROLOOP_BROKER_URL is required to send notifications.");
    }
  });
  const botConnection = local && brokerUrl
    ? startBotConnection(connection.database, brokerUrl, stopping.signal) : undefined;

  console.log("reproloop-worker ready");

  async function shutdown(): Promise<void> {
    stopping.abort();
    await boss.stop({ graceful: true });
    await botConnection;
    await connection.close();
  }

  process.once("SIGINT", () => void shutdown());
  process.once("SIGTERM", () => void shutdown());
}

main().catch((error) => {
  console.error("reproloop-worker failed", error);
  process.exitCode = 1;
});
