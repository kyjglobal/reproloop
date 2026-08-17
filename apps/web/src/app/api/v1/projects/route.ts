import type { ApiListResponse, ProjectSummary } from "@reproloop/shared";
import { NextResponse } from "next/server";

import { createApiErrorResponse, getRequestId } from "@/server/api/error-response";
import { getAuthGuards } from "@/server/auth/runtime";
import { getProjectQueryRepository } from "@/server/projects/runtime";
import { listAccessibleProjects } from "@/server/projects/service";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const requestId = getRequestId(request);

  try {
    const data = await listAccessibleProjects(
      getAuthGuards(),
      getProjectQueryRepository(),
    );
    const body: ApiListResponse<ProjectSummary> = { data, meta: { nextCursor: null } };

    return NextResponse.json(body, { headers: { "x-request-id": requestId } });
  } catch (error) {
    return createApiErrorResponse(error, requestId);
  }
}
