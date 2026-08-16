import { describe, expect, it } from "vitest";

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
});
