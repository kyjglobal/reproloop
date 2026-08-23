import {
  ReportTransitionSchema,
  type ApiDataResponse,
  type ReportTransitionResult,
} from "@reproloop/shared";
import { NextResponse } from "next/server";

import { createApiErrorResponse, getRequestId } from "@/server/api/error-response";
import { parseJsonRequestBody, ReportIdParamsSchema } from "@/server/api/params";
import { getReportTransitionDependencies } from "@/server/reports/runtime";
import { dispatchReportTransition } from "@/server/reports/transition-dispatcher";

export const runtime = "nodejs";

interface ReportTransitionsRouteContext {
  params: Promise<{ reportId: string }>;
}

export async function POST(request: Request, context: ReportTransitionsRouteContext) {
  const requestId = getRequestId(request);

  try {
    const { reportId } = ReportIdParamsSchema.parse(await context.params);
    const transition = ReportTransitionSchema.parse(await parseJsonRequestBody(request));
    const data = await dispatchReportTransition(
      getReportTransitionDependencies(),
      reportId,
      transition,
    );
    const body: ApiDataResponse<ReportTransitionResult> = { data };

    return NextResponse.json(body, { headers: { "x-request-id": requestId } });
  } catch (error) {
    return createApiErrorResponse(error, requestId);
  }
}
