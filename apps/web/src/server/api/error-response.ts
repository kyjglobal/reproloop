import type { ApiErrorCode, ApiErrorResponse } from "@reproloop/shared";
import { NextResponse } from "next/server";

import { AuthAccessError } from "../auth/errors";

const HTTP_STATUS_BY_CODE: Record<ApiErrorCode, number> = {
  VALIDATION_ERROR: 400,
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  INVALID_STATUS_TRANSITION: 409,
  FILE_TOO_LARGE: 413,
  UNSUPPORTED_MEDIA_TYPE: 415,
  RATE_LIMITED: 429,
  INTERNAL_ERROR: 500,
};

export function getRequestId(request: Request): string {
  return request.headers.get("x-request-id")?.trim() || `req_${crypto.randomUUID()}`;
}

export function createApiErrorResponse(error: unknown, requestId: string) {
  const code: ApiErrorCode = error instanceof AuthAccessError ? error.code : "INTERNAL_ERROR";
  const message =
    error instanceof AuthAccessError
      ? error.message
      : "요청을 처리하는 중 서버 오류가 발생했습니다.";

  if (!(error instanceof AuthAccessError)) {
    console.error(`[${requestId}] Unexpected API error`, error);
  }

  const body: ApiErrorResponse = {
    error: {
      code,
      message,
      requestId,
    },
  };

  return NextResponse.json(body, {
    status: HTTP_STATUS_BY_CODE[code],
    headers: { "x-request-id": requestId },
  });
}
