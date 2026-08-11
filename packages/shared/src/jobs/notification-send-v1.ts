import { z } from "zod";

export const NotificationSendJobV1Schema = z.strictObject({
  jobName: z.literal("notification.send.v1"),
  version: z.literal(1),
  notificationId: z.string().uuid(),
});

export type NotificationSendJobV1 = z.infer<typeof NotificationSendJobV1Schema>;
