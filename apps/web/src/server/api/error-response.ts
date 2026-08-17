import type { ApiErrorCode, ApiErrorResponse } from "@reproloop/shared";
import { ReportDomainError } from "@reproloop/domain";
import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { AuthAccessError } from "../auth/errors";
import { ApiRequestError } from "./errors";

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

function copyFieldErrors(
  fieldErrors?: Readonly<Record<string, readonly string[]>>,
): Record<string, string[]> | undefined {
  if (!fieldErrors) {
    return undefined;
  }

  return Object.fromEntries(
    Object.entries(fieldErrors).map(([field, messages]) => [field, [...messages]]),
  );
}

function getZodFieldErrors(error: ZodError): Record<string, string[]> {
  const fieldErrors: Record<string, string[]> = {};

  for (const issue of error.issues) {
    const field = issue.path.map(String).join(".") || "_root";
    (fieldErrors[field] ??= []).push(issue.message);
  }

  return fieldErrors;
}

export function createApiErrorResponse(error: unknown, requestId: string) {
  let code: ApiErrorCode = "INTERNAL_ERROR";
  let message = "요청을 처리하는 중 서버 오류가 발생했습니다.";
  let fieldErrors: Record<string, string[]> | undefined;

  if (error instanceof AuthAccessError) {
    code = error.code;
    message = error.message;
  } else if (error instanceof ApiRequestError) {
    code = error.code;
    message = error.message;
    fieldErrors = copyFieldErrors(error.fieldErrors);
  } else if (error instanceof ReportDomainError) {
    code = error.code;
    message = error.message;
    fieldErrors = copyFieldErrors(error.fieldErrors);
  } else if (error instanceof ZodError) {
    code = "VALIDATION_ERROR";
    message = "요청 값이 올바르지 않습니다.";
    fieldErrors = getZodFieldErrors(error);
  }

  if (code === "INTERNAL_ERROR") {
    console.error(`[${requestId}] Unexpected API error`, error);
  }

  const body: ApiErrorResponse = {
    error: {
      code,
      message,
      requestId,
      ...(fieldErrors ? { fieldErrors } : {}),
    },
  };

  return NextResponse.json(body, {
    status: HTTP_STATUS_BY_CODE[code],
    headers: { "x-request-id": requestId },
  });
}
