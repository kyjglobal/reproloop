import type { ApiDataResponse, ProjectSummary } from "@reproloop/shared";
import { NextResponse } from "next/server";

import { createApiErrorResponse, getRequestId } from "@/server/api/error-response";
import { ProjectIdParamsSchema } from "@/server/api/params";
import { getAuthGuards } from "@/server/auth/runtime";
import { getProjectQueryRepository } from "@/server/projects/runtime";
import { getAccessibleProject } from "@/server/projects/service";

export const runtime = "nodejs";

interface ProjectRouteContext {
  params: Promise<{ projectId: string }>;
}

export async function GET(request: Request, context: ProjectRouteContext) {
  const requestId = getRequestId(request);

  try {
    const { projectId } = ProjectIdParamsSchema.parse(await context.params);
    const data = await getAccessibleProject(
      getAuthGuards(),
      getProjectQueryRepository(),
      projectId,
    );
    const body: ApiDataResponse<ProjectSummary> = { data };

    return NextResponse.json(body, { headers: { "x-request-id": requestId } });
  } catch (error) {
    return createApiErrorResponse(error, requestId);
  }
}
