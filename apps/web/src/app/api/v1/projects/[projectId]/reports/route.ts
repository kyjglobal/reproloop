import {
  ReportListQuerySchema,
  type ApiListResponse,
  type ReportListItem,
} from "@reproloop/shared";
import { NextResponse } from "next/server";

import { createApiErrorResponse, getRequestId } from "@/server/api/error-response";
import { ProjectIdParamsSchema, searchParamsToObject } from "@/server/api/params";
import { getAuthGuards } from "@/server/auth/runtime";
import { getReportListQueryRepository } from "@/server/reports/runtime";
import { listAccessibleProjectReports } from "@/server/reports/service";

export const runtime = "nodejs";

interface ProjectReportsRouteContext {
  params: Promise<{ projectId: string }>;
}

export async function GET(request: Request, context: ProjectReportsRouteContext) {
  const requestId = getRequestId(request);

  try {
    const { projectId } = ProjectIdParamsSchema.parse(await context.params);
    const query = ReportListQuerySchema.parse(
      searchParamsToObject(new URL(request.url).searchParams),
    );
    const page = await listAccessibleProjectReports(
      getAuthGuards(),
      getReportListQueryRepository(),
      projectId,
      query,
    );
    const body: ApiListResponse<ReportListItem> = {
      data: page.items,
      meta: { nextCursor: page.nextCursor },
    };

    return NextResponse.json(body, { headers: { "x-request-id": requestId } });
  } catch (error) {
    return createApiErrorResponse(error, requestId);
  }
}
