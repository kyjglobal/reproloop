import type { ApiListResponse, BuildSummary } from "@reproloop/shared";
import { NextResponse } from "next/server";

import { createApiErrorResponse, getRequestId } from "@/server/api/error-response";
import { ProjectIdParamsSchema } from "@/server/api/params";
import { getAuthGuards } from "@/server/auth/runtime";
import { getBuildQueryRepository } from "@/server/builds/runtime";
import { listAccessibleProjectBuilds } from "@/server/builds/service";

export const runtime = "nodejs";

interface ProjectBuildsRouteContext {
  params: Promise<{ projectId: string }>;
}

export async function GET(request: Request, context: ProjectBuildsRouteContext) {
  const requestId = getRequestId(request);

  try {
    const { projectId } = ProjectIdParamsSchema.parse(await context.params);
    const data = await listAccessibleProjectBuilds(
      getAuthGuards(),
      getBuildQueryRepository(),
      projectId,
    );
    const body: ApiListResponse<BuildSummary> = { data, meta: { nextCursor: null } };

    return NextResponse.json(body, { headers: { "x-request-id": requestId } });
  } catch (error) {
    return createApiErrorResponse(error, requestId);
  }
}
