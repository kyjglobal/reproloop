import type { DatabaseTransaction } from "@reproloop/db/client";
import type { NotificationSendJobV1 } from "@reproloop/shared";
import { sql } from "drizzle-orm";
import { fromDrizzle, PgBoss } from "pg-boss";

const NOTIFICATION_QUEUE = "notification.send.v1";

const queueGlobal = globalThis as typeof globalThis & {
  reproloopPgBoss?: PgBoss;
  reproloopPgBossReady?: Promise<PgBoss>;
};

function readDatabaseUrl(): string {
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is missing or empty.");
  }
  return databaseUrl;
}

async function getReadyPgBoss(): Promise<PgBoss> {
  queueGlobal.reproloopPgBoss ??= new PgBoss(readDatabaseUrl());
  queueGlobal.reproloopPgBossReady ??= (async () => {
    const boss = await queueGlobal.reproloopPgBoss!.start();
    await boss.createQueue(NOTIFICATION_QUEUE);
    return boss;
  })();

  return queueGlobal.reproloopPgBossReady;
}

export async function enqueueNotificationJob(
  transaction: DatabaseTransaction,
  job: NotificationSendJobV1,
): Promise<void> {
  const boss = await getReadyPgBoss();
  const jobId = await boss.send(NOTIFICATION_QUEUE, job, {
    db: fromDrizzle(transaction, sql),
    singletonKey: job.notificationId,
    retryLimit: 5,
    retryDelay: 30,
    retryBackoff: true,
  });

  if (!jobId) {
    throw new Error("Failed to enqueue the notification job.");
  }
}
