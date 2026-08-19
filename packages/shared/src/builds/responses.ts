import { z } from "zod";

import { createApiListResponseSchema } from "../api/response.js";

export const BuildSummarySchema = z.strictObject({
  id: z.string().uuid(),
  projectId: z.string().uuid(),
  version: z.string().trim().min(1),
  isActive: z.boolean(),
  releasedAt: z.string().datetime({ offset: true }).nullable(),
});

export const BuildListResponseSchema = createApiListResponseSchema(BuildSummarySchema);

export type BuildSummary = z.infer<typeof BuildSummarySchema>;
