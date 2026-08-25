import type { Database } from "@reproloop/db/client";
import { bugReports, builds, notifications } from "@reproloop/db/schema";
import { eq, sql } from "drizzle-orm";

import type {
  NotificationRepository,
  PendingNotification,
} from "./notification-service.js";

function describeError(error: unknown): { code: string; message: string } {
  if (error instanceof Error) {
    return { code: error.name, message: error.message.slice(0, 2000) };
  }
  return { code: "UnknownError", message: String(error).slice(0, 2000) };
}

export class DrizzleNotificationRepository implements NotificationRepository {
  constructor(private readonly database: Database) {}

  async findById(notificationId: string): Promise<PendingNotification | null> {
    const [row] = await this.database
      .select({
        id: notifications.id,
        status: notifications.status,
        type: notifications.type,
        recipientDiscordUserId: notifications.recipientDiscordUserId,
        reportNumber: bugReports.reportNumber,
        reportTitle: bugReports.title,
        fixedBuildVersion: builds.version,
      })
      .from(notifications)
      .innerJoin(bugReports, eq(bugReports.id, notifications.reportId))
      .leftJoin(builds, eq(builds.id, bugReports.fixedBuildId))
      .where(eq(notifications.id, notificationId))
      .limit(1);

    return row ?? null;
  }

  async markProcessing(notificationId: string): Promise<void> {
    await this.database
      .update(notifications)
      .set({
        status: "processing",
        attemptCount: sql`${notifications.attemptCount} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(notifications.id, notificationId));
  }

  async markSent(notificationId: string): Promise<void> {
    await this.database
      .update(notifications)
      .set({
        status: "sent",
        sentAt: new Date(),
        lastErrorCode: null,
        lastErrorMessage: null,
        updatedAt: new Date(),
      })
      .where(eq(notifications.id, notificationId));
  }

  async markFailed(notificationId: string, error: unknown): Promise<void> {
    const details = describeError(error);
    await this.database
      .update(notifications)
      .set({
        status: "failed",
        lastErrorCode: details.code,
        lastErrorMessage: details.message,
        updatedAt: new Date(),
      })
      .where(eq(notifications.id, notificationId));
  }
}
