import { NextResponse } from "next/server";

import { createApiErrorResponse, getRequestId } from "@/server/api/error-response";
import { getCurrentUserProfile } from "@/server/auth/current-user";
import { getAuthAccessRepository, getAuthGuards } from "@/server/auth/runtime";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const requestId = getRequestId(request);

  try {
    const data = await getCurrentUserProfile(getAuthGuards(), getAuthAccessRepository());

    return NextResponse.json(
      { data },
      {
        headers: { "x-request-id": requestId },
      },
    );
  } catch (error) {
    return createApiErrorResponse(error, requestId);
  }
}
