import { z } from "zod";

import { ReportStatusSchema } from "../enums/report.js";

const ReportStatusListSchema = z.preprocess(
  (value) =>
    typeof value === "string"
      ? value
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean)
      : value,
  z.array(ReportStatusSchema).min(1),
);

export const ReportListQuerySchema = z.strictObject({
  status: ReportStatusListSchema.optional(),
  buildId: z.string().uuid().optional(),
  search: z.string().trim().min(1).max(200).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().min(1).optional(),
});

export type ReportListQuery = z.infer<typeof ReportListQuerySchema>;

export const DuplicateCandidateQuerySchema = z.strictObject({
  search: z.string().trim().min(1).max(200).optional(),
  limit: z.coerce.number().int().min(1).max(25).default(10),
});

export type DuplicateCandidateQuery = z.infer<typeof DuplicateCandidateQuerySchema>;
