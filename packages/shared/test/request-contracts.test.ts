import { describe, expect, it } from "vitest";

import {
  CreateBugReportCommandSchema,
  ReportListQuerySchema,
  ReportTransitionSchema,
  UpdateReportSchema,
} from "../src/index.js";

const reportId = "0198e9d1-c451-76ac-8e87-95dbf12d51fd";

describe("request contracts", () => {
  it("parses comma-separated status filters and defaults the limit", () => {
    expect(ReportListQuerySchema.parse({ status: "new,reproduced" })).toEqual({
      status: ["new", "reproduced"],
      limit: 20,
    });
  });

  it("requires action-specific transition fields", () => {
    expect(
      ReportTransitionSchema.safeParse({
        action: "mark_fixed",
        expectedVersion: 3,
      }).success,
    ).toBe(false);
    expect(
      ReportTransitionSchema.safeParse({
        action: "merge_duplicate",
        canonicalReportId: reportId,
        expectedVersion: 3,
      }).success,
    ).toBe(true);
  });

  it("requires at least one editable report field", () => {
    expect(UpdateReportSchema.safeParse({ version: 3 }).success).toBe(false);
    expect(UpdateReportSchema.safeParse({ severity: "high", version: 3 }).success).toBe(true);
  });

  it("defaults a new report severity to medium", () => {
    const parsed = CreateBugReportCommandSchema.parse({
      projectId: reportId,
      buildId: reportId,
      title: "게임 정지",
      actualResult: "게임이 정지함",
      expectedResult: "전투가 시작되어야 함",
      reproductionSteps: "인벤토리 키를 누름",
      platform: "Windows 11",
      frequency: "5회 중 3회",
      reporterDiscordUserId: "123",
      reporterDisplayName: "tester",
      discordGuildId: "456",
      sourceChannelId: "789",
      discordInteractionId: "interaction-1",
    });

    expect(parsed.severity).toBe("medium");
  });
});
