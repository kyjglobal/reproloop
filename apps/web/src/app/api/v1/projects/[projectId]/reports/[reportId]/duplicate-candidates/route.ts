import {
  DuplicateCandidateQuerySchema,
  type ApiListResponse,
  type DuplicateCandidate,
} from "@reproloop/shared";
import { NextResponse } from "next/server";

import { createApiErrorResponse, getRequestId } from "@/server/api/error-response";
import {
  ProjectReportIdParamsSchema,
  searchParamsToObject,
} from "@/server/api/params";
import { getAuthGuards } from "@/server/auth/runtime";
import { getDuplicateCandidateQueryRepository } from "@/server/reports/runtime";
import { listAccessibleDuplicateCandidates } from "@/server/reports/service";

export const runtime = "nodejs";

interface DuplicateCandidatesRouteContext {
  params: Promise<{ projectId: string; reportId: string }>;
}

export async function GET(request: Request, context: DuplicateCandidatesRouteContext) {
  const requestId = getRequestId(request);

  try {
    const { projectId, reportId } = ProjectReportIdParamsSchema.parse(
      await context.params,
    );
    const query = DuplicateCandidateQuerySchema.parse(
      searchParamsToObject(new URL(request.url).searchParams),
    );
    const candidates = await listAccessibleDuplicateCandidates(
      getAuthGuards(),
      getDuplicateCandidateQueryRepository(),
      projectId,
      reportId,
      query,
    );
    const body: ApiListResponse<DuplicateCandidate> = {
      data: candidates,
      meta: { nextCursor: null },
    };

    return NextResponse.json(body, { headers: { "x-request-id": requestId } });
  } catch (error) {
    return createApiErrorResponse(error, requestId);
  }
}
