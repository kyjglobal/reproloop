import type { ApiDataResponse, ReportDetail } from "@reproloop/shared";
import { NextResponse } from "next/server";

import { createApiErrorResponse, getRequestId } from "@/server/api/error-response";
import { ReportIdParamsSchema } from "@/server/api/params";
import { getAuthGuards } from "@/server/auth/runtime";
import { getReportDetailQueryRepository } from "@/server/reports/runtime";
import { getAccessibleReportDetail } from "@/server/reports/service";

export const runtime = "nodejs";

interface ReportDetailRouteContext {
  params: Promise<{ reportId: string }>;
}

export async function GET(request: Request, context: ReportDetailRouteContext) {
  const requestId = getRequestId(request);

  try {
    const { reportId } = ReportIdParamsSchema.parse(await context.params);
    const data = await getAccessibleReportDetail(
      getAuthGuards(),
      getReportDetailQueryRepository(),
      reportId,
    );
    const body: ApiDataResponse<ReportDetail> = { data };

    return NextResponse.json(body, { headers: { "x-request-id": requestId } });
  } catch (error) {
    return createApiErrorResponse(error, requestId);
  }
}
