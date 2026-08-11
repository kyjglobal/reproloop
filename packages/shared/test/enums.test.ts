import { describe, expect, it } from "vitest";

import {
  ApiErrorCodeSchema,
  OrganizationRoleSchema,
  ReportSeveritySchema,
  ReportStatusSchema,
  ReportTransitionActionSchema,
  StatusEventTypeSchema,
  WorkerJobNameSchema,
} from "../src/index.js";

describe("shared enums", () => {
  it("accepts the approved report values", () => {
    expect(ReportStatusSchema.parse("needs_info")).toBe("needs_info");
    expect(ReportSeveritySchema.parse("critical")).toBe("critical");
    expect(ReportTransitionActionSchema.parse("mark_fixed")).toBe("mark_fixed");
    expect(StatusEventTypeSchema.parse("duplicate_unmerged")).toBe("duplicate_unmerged");
  });

  it("rejects values outside the contract", () => {
    expect(ReportStatusSchema.safeParse("closed").success).toBe(false);
    expect(ReportStatusSchema.safeParse("in_progress").success).toBe(false);
    expect(OrganizationRoleSchema.safeParse("viewer").success).toBe(false);
  });

  it("accepts worker job and API error names", () => {
    expect(WorkerJobNameSchema.parse("notification.send.v1")).toBe("notification.send.v1");
    expect(ApiErrorCodeSchema.parse("INVALID_STATUS_TRANSITION")).toBe(
      "INVALID_STATUS_TRANSITION",
    );
  });
});
