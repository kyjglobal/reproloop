import { z } from "zod";

export const AttachmentDeleteJobV1Schema = z.strictObject({
  jobName: z.literal("attachment.delete.v1"),
  version: z.literal(1),
  attachmentId: z.string().uuid(),
});

export type AttachmentDeleteJobV1 = z.infer<typeof AttachmentDeleteJobV1Schema>;
