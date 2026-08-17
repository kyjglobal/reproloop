import { ReportDomainError } from "@reproloop/domain";
import { describe, expect, it } from "vitest";
import { z } from "zod";

import { createApiErrorResponse, getRequestId } from "../src/server/api/error-response";
import { AuthAccessError } from "../src/server/auth/errors";

describe("API error responses", () => {
  it("maps an authentication error to the shared 401 response shape", async () => {
    const response = createApiErrorResponse(
      new AuthAccessError("UNAUTHENTICATED", "로그인이 필요합니다."),
      "req_test",
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: "UNAUTHENTICATED",
        message: "로그인이 필요합니다.",
        requestId: "req_test",
      },
    });
  });

  it("keeps an incoming request ID for log correlation", () => {
    const request = new Request("http://localhost/api/v1/me", {
      headers: { "x-request-id": "req_from_proxy" },
    });

    expect(getRequestId(request)).toBe("req_from_proxy");
  });

  it("maps Zod issues to VALIDATION_ERROR field errors", async () => {
    const result = z.strictObject({ limit: z.coerce.number().int().min(1) }).safeParse({
      limit: "0",
    });
    expect(result.success).toBe(false);
    if (result.success) {
      return;
    }

    const response = createApiErrorResponse(result.error, "req_validation");

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: "VALIDATION_ERROR",
        requestId: "req_validation",
        fieldErrors: { limit: [expect.any(String)] },
      },
    });
  });

  it("preserves domain error codes and field errors", async () => {
    const response = createApiErrorResponse(
      new ReportDomainError("NOT_FOUND", "제보를 찾을 수 없습니다.", {
        reportId: ["존재하지 않는 제보입니다."],
      }),
      "req_domain",
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: "NOT_FOUND",
        message: "제보를 찾을 수 없습니다.",
        requestId: "req_domain",
        fieldErrors: { reportId: ["존재하지 않는 제보입니다."] },
      },
    });
  });
});
