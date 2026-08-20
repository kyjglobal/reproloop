import { z } from "zod";

export const ProjectIdParamsSchema = z.strictObject({
  projectId: z.string().uuid(),
});

export const ReportIdParamsSchema = z.strictObject({
  reportId: z.string().uuid(),
});

export const ProjectReportIdParamsSchema = z.strictObject({
  projectId: z.string().uuid(),
  reportId: z.string().uuid(),
});

export function searchParamsToObject(searchParams: URLSearchParams): Record<string, string> {
  return Object.fromEntries(searchParams.entries());
}
