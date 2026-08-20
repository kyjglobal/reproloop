import { z } from "zod";

import {
  createApiDataResponseSchema,
  createApiListResponseSchema,
} from "../api/response.js";
import {
  ReportSeveritySchema,
  ReportStatusSchema,
  StatusEventTypeSchema,
} from "../enums/report.js";

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

export const ReportReferenceSchema = z.strictObject({
  id: z.string().uuid(),
  reportNumber: z.number().int().positive(),
  title: z.string().trim().min(1).max(200),
  status: ReportStatusSchema,
});

export const ReportAttachmentMetadataSchema = z.strictObject({
  id: z.string().uuid(),
  originalFilename: z.string().trim().min(1),
  contentType: z.string().trim().min(1),
  sizeBytes: z.number().int().nonnegative(),
  sanitizedAt: z.string().datetime({ offset: true }).nullable(),
  createdAt: z.string().datetime({ offset: true }),
});

export const ReportStatusEventActorSchema = z.strictObject({
  id: z.string().uuid(),
  displayName: z.string().trim().min(1),
});

export const ReportStatusEventSchema = z.strictObject({
  id: z.string().uuid(),
  eventType: StatusEventTypeSchema,
  fromStatus: ReportStatusSchema.nullable(),
  toStatus: ReportStatusSchema,
  actor: ReportStatusEventActorSchema.nullable(),
  note: z.string().nullable(),
  createdAt: z.string().datetime({ offset: true }),
});

export const ReportDetailSchema = z.strictObject({
  id: z.string().uuid(),
  projectId: z.string().uuid(),
  reportNumber: z.number().int().positive(),
  title: z.string().trim().min(1).max(200),
  status: ReportStatusSchema,
  severity: ReportSeveritySchema,
  build: ReportBuildSummarySchema,
  fixedBuild: ReportBuildSummarySchema.nullable(),
  canonicalReport: ReportReferenceSchema.nullable(),
  reporterDiscordUserId: z.string().trim().min(1),
  reporterDisplayName: z.string().trim().min(1),
  actualResult: z.string().trim().min(1),
  expectedResult: z.string().trim().min(1),
  reproductionSteps: z.string().trim().min(1),
  platform: z.string().trim().min(1),
  environment: z.string().nullable(),
  location: z.string().nullable(),
  frequency: z.string().trim().min(1),
  duplicateCount: z.number().int().nonnegative(),
  attachments: z.array(ReportAttachmentMetadataSchema),
  statusEvents: z.array(ReportStatusEventSchema),
  resolvedAt: z.string().datetime({ offset: true }).nullable(),
  createdAt: z.string().datetime({ offset: true }),
  updatedAt: z.string().datetime({ offset: true }),
  version: z.number().int().nonnegative(),
});

export const ReportDetailResponseSchema = createApiDataResponseSchema(ReportDetailSchema);

export type ReportBuildSummary = z.infer<typeof ReportBuildSummarySchema>;
export type ReportListItem = z.infer<typeof ReportListItemSchema>;
export type ReportReference = z.infer<typeof ReportReferenceSchema>;
export type ReportAttachmentMetadata = z.infer<typeof ReportAttachmentMetadataSchema>;
export type ReportStatusEvent = z.infer<typeof ReportStatusEventSchema>;
export type ReportDetail = z.infer<typeof ReportDetailSchema>;
