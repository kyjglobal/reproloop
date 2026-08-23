import { z } from "zod";

import { ApiRequestError } from "./errors";

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

export async function parseJsonRequestBody(request: Request): Promise<unknown> {
  const contentType = request.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase();
  if (contentType !== "application/json") {
    throw new ApiRequestError(
      "UNSUPPORTED_MEDIA_TYPE",
      "Content-Type은 application/json이어야 합니다.",
    );
  }

  try {
    return await request.json();
  } catch {
    throw new ApiRequestError("VALIDATION_ERROR", "올바른 JSON 본문이 필요합니다.");
  }
}
