import { describe, expect, it, vi } from "vitest";

import type { DiscordNotificationClient } from "./discord-client.js";
import {
  processNotificationJob,
  type NotificationRepository,
  type PendingNotification,
} from "./notification-service.js";

const notificationId = "11111111-1111-4111-8111-111111111111";

function createFixture(overrides: Partial<PendingNotification> = {}) {
  const notification: PendingNotification = {
    id: notificationId,
    status: "queued",
    type: "report_fixed",
    recipientDiscordUserId: "discord-user-1",
    reportNumber: 42,
    reportTitle: "인벤토리 화면 멈춤",
    fixedBuildVersion: "1.2.0",
    ...overrides,
  };
  const repository: NotificationRepository = {
    findById: vi.fn(async () => notification),
    markProcessing: vi.fn(async () => undefined),
    markSent: vi.fn(async () => undefined),
    markFailed: vi.fn(async () => undefined),
  };
  const discordClient: DiscordNotificationClient = {
    sendDirectMessage: vi.fn(async () => undefined),
  };

  return { repository, discordClient };
}

describe("notification worker service", () => {
  it("sends a fixed report DM and records success", async () => {
    const { repository, discordClient } = createFixture();

    await expect(
      processNotificationJob(repository, discordClient, {
        jobName: "notification.send.v1",
        version: 1,
        notificationId,
      }),
    ).resolves.toBe("sent");

    expect(discordClient.sendDirectMessage).toHaveBeenCalledWith(
      "discord-user-1",
      "BUG-42 수정 완료\n인벤토리 화면 멈춤\n수정 빌드: 1.2.0",
    );
    expect(repository.markProcessing).toHaveBeenCalledWith(notificationId);
    expect(repository.markSent).toHaveBeenCalledWith(notificationId);
  });

  it("does not send an already completed notification twice", async () => {
    const { repository, discordClient } = createFixture({ status: "sent" });

    await expect(
      processNotificationJob(repository, discordClient, {
        jobName: "notification.send.v1",
        version: 1,
        notificationId,
      }),
    ).resolves.toBe("already_sent");
    expect(discordClient.sendDirectMessage).not.toHaveBeenCalled();
    expect(repository.markProcessing).not.toHaveBeenCalled();
  });

  it("records a failed attempt and rethrows for pg-boss retry", async () => {
    const { repository, discordClient } = createFixture();
    const error = new Error("Discord unavailable");
    vi.mocked(discordClient.sendDirectMessage).mockRejectedValue(error);

    await expect(
      processNotificationJob(repository, discordClient, {
        jobName: "notification.send.v1",
        version: 1,
        notificationId,
      }),
    ).rejects.toThrow("Discord unavailable");
    expect(repository.markFailed).toHaveBeenCalledWith(notificationId, error);
    expect(repository.markSent).not.toHaveBeenCalled();
  });
});
