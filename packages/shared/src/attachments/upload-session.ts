import { z } from "zod";

export const CreateUploadSessionSchema = z.strictObject({
  reportId: z.string().uuid(),
});

export type CreateUploadSession = z.infer<typeof CreateUploadSessionSchema>;
