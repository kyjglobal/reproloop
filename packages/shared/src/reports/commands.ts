import { z } from "zod";

import { DiscordBugModalInputSchema } from "../discord/bug-modal.js";
import { ReportSeveritySchema } from "../enums/report.js";

const UuidSchema = z.string().uuid();
const ExpectedVersionSchema = z.number().int().nonnegative();

export const CreateBugReportCommandSchema = DiscordBugModalInputSchema.extend({
  projectId: UuidSchema,
  buildId: UuidSchema,
  title: z.string().trim().min(1).max(200),
  severity: ReportSeveritySchema.default("medium"),
  environment: z.string().trim().max(2000).optional(),
  location: z.string().trim().max(500).optional(),
  reporterDiscordUserId: z.string().trim().min(1),
  reporterDisplayName: z.string().trim().min(1).max(200),
  discordGuildId: z.string().trim().min(1),
  sourceChannelId: z.string().trim().min(1),
  discordInteractionId: z.string().trim().min(1),
}).strict();

export const UpdateReportSchema = z
  .strictObject({
    title: z.string().trim().min(1).max(200).optional(),
    severity: ReportSeveritySchema.optional(),
    location: z.string().trim().max(500).nullable().optional(),
    frequency: z.string().trim().min(1).max(200).optional(),
    version: ExpectedVersionSchema,
  })
  .refine(
    ({ title, severity, location, frequency }) =>
      title !== undefined ||
      severity !== undefined ||
      location !== undefined ||
      frequency !== undefined,
    { message: "At least one editable field is required" },
  );

const RequestInformationSchema = z.strictObject({
  action: z.literal("request_information"),
  message: z.string().trim().min(1).max(2000),
  expectedVersion: ExpectedVersionSchema,
});

const StartInvestigationSchema = z.strictObject({
  action: z.literal("start_investigation"),
  note: z.string().trim().max(2000).optional(),
  expectedVersion: ExpectedVersionSchema,
});

const MarkReproducedSchema = z.strictObject({
  action: z.literal("mark_reproduced"),
  note: z.string().trim().max(2000).optional(),
  expectedVersion: ExpectedVersionSchema,
});

const MergeDuplicateSchema = z.strictObject({
  action: z.literal("merge_duplicate"),
  canonicalReportId: UuidSchema,
  note: z.string().trim().max(2000).optional(),
  expectedVersion: ExpectedVersionSchema,
});

const MarkFixedSchema = z.strictObject({
  action: z.literal("mark_fixed"),
  fixedBuildId: UuidSchema,
  note: z.string().trim().max(2000).optional(),
  expectedVersion: ExpectedVersionSchema,
});

const UnmergeDuplicateSchema = z.strictObject({
  action: z.literal("unmerge_duplicate"),
  note: z.string().trim().max(2000).optional(),
  expectedVersion: ExpectedVersionSchema,
});

export const ReportTransitionSchema = z.discriminatedUnion("action", [
  RequestInformationSchema,
  StartInvestigationSchema,
  MarkReproducedSchema,
  MergeDuplicateSchema,
  MarkFixedSchema,
  UnmergeDuplicateSchema,
]);

export type CreateBugReportCommand = z.infer<typeof CreateBugReportCommandSchema>;
export type UpdateReport = z.infer<typeof UpdateReportSchema>;
export type ReportTransition = z.infer<typeof ReportTransitionSchema>;
