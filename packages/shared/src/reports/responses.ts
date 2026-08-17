import { z } from "zod";

import { createApiListResponseSchema } from "../api/response.js";
import { ReportSeveritySchema, ReportStatusSchema } from "../enums/report.js";

export const ReportBuildSummarySchema = z.strictObject({
  id: z.string().uuid(),
  version: z.string().trim().min(1),
});

export const ReportListItemSchema = z.strictObject({
  id: z.string().uuid(),
  projectId: z.string().uuid(),
  reportNumber: z.number().int().positive(),
  title: z.string().trim().min(1).max(200),
  status: ReportStatusSchema,
  severity: ReportSeveritySchema,
  build: ReportBuildSummarySchema,
  reporterDisplayName: z.string().trim().min(1),
  duplicateCount: z.number().int().nonnegative(),
  createdAt: z.string().datetime({ offset: true }),
  version: z.number().int().nonnegative(),
});

export const ReportListResponseSchema = createApiListResponseSchema(ReportListItemSchema);

export type ReportBuildSummary = z.infer<typeof ReportBuildSummarySchema>;
export type ReportListItem = z.infer<typeof ReportListItemSchema>;
