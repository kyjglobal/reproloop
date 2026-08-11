import { describe, expect, it } from "vitest";
import { z } from "zod";

import {
  ApiErrorSchema,
  createApiDataResponseSchema,
  createApiListResponseSchema,
} from "../src/index.js";

const ReportSummarySchema = z.strictObject({ id: z.string().uuid() });
const reportId = "0198e9d1-c451-76ac-8e87-95dbf12d51fd";

describe("API response contracts", () => {
  it("validates a strict single-resource response", () => {
    const schema = createApiDataResponseSchema(ReportSummarySchema);

    expect(schema.parse({ data: { id: reportId } })).toEqual({ data: { id: reportId } });
    expect(schema.safeParse({ data: null }).success).toBe(false);
    expect(schema.safeParse({ data: { id: reportId }, error: {} }).success).toBe(false);
  });

  it("requires list metadata and permits a null final cursor", () => {
    const schema = createApiListResponseSchema(ReportSummarySchema);

    expect(schema.parse({ data: [], meta: { nextCursor: null } })).toEqual({
      data: [],
      meta: { nextCursor: null },
    });
    expect(schema.safeParse({ data: [] }).success).toBe(false);
    expect(schema.safeParse({ data: null, meta: { nextCursor: null } }).success).toBe(false);
  });

  it("validates optional field errors without accepting null", () => {
    const base = {
      error: {
        code: "VALIDATION_ERROR",
        message: "입력값을 확인해 주세요.",
        requestId: "req_01J",
      },
    } as const;

    expect(ApiErrorSchema.safeParse(base).success).toBe(true);
    expect(
      ApiErrorSchema.safeParse({
        error: { ...base.error, fieldErrors: { fixedBuildId: ["필수 값입니다."] } },
      }).success,
    ).toBe(true);
    expect(ApiErrorSchema.safeParse({ error: { ...base.error, fieldErrors: null } }).success).toBe(
      false,
    );
  });
});
