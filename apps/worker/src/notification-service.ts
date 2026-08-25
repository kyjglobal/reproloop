import type { NotificationSendJobV1 } from "@reproloop/shared";

import type { DiscordNotificationClient } from "./discord-client.js";

export interface PendingNotification {
  id: string;
  status: "queued" | "processing" | "sent" | "failed";
  type: "information_requested" | "report_fixed";
  recipientDiscordUserId: string;
  reportNumber: number;
  reportTitle: string;
  fixedBuildVersion: string | null;
}

export interface NotificationRepository {
  findById(notificationId: string): Promise<PendingNotification | null>;
  markProcessing(notificationId: string): Promise<void>;
  markSent(notificationId: string): Promise<void>;
  markFailed(notificationId: string, error: unknown): Promise<void>;
}

function createMessage(notification: PendingNotification): string {
  if (notification.type !== "report_fixed" || !notification.fixedBuildVersion) {
    throw new Error("The notification does not contain fixed report data.");
  }

  return [
    `BUG-${notification.reportNumber} 수정 완료`,
    notification.reportTitle,
    `수정 빌드: ${notification.fixedBuildVersion}`,
  ].join("\n");
}

export async function processNotificationJob(
  repository: NotificationRepository,
  discordClient: DiscordNotificationClient,
  job: NotificationSendJobV1,
): Promise<"sent" | "already_sent"> {
  const notification = await repository.findById(job.notificationId);
  if (!notification) {
    throw new Error(`Notification ${job.notificationId} was not found.`);
  }
  if (notification.status === "sent") {
    return "already_sent";
  }

  await repository.markProcessing(notification.id);
  try {
    await discordClient.sendDirectMessage(
      notification.recipientDiscordUserId,
      createMessage(notification),
    );
    await repository.markSent(notification.id);
    return "sent";
  } catch (error) {
    await repository.markFailed(notification.id, error);
    throw error;
  }
}
