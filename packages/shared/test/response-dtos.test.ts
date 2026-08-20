import { describe, expect, it } from "vitest";

import {
  BuildListResponseSchema,
  ProjectListResponseSchema,
  ProjectSummaryResponseSchema,
  ReportDetailResponseSchema,
  ReportListResponseSchema,
} from "../src/index.js";

const project = {
  id: "11111111-1111-4111-8111-111111111111",
  organizationId: "22222222-2222-4222-8222-222222222222",
  organizationName: "Small Moon Studio",
  name: "Repro Quest",
  slug: "repro-quest",
  defaultLocale: "ko",
  role: "admin" as const,
};

const report = {
  id: "33333333-3333-4333-8333-333333333333",
  projectId: project.id,
  reportNumber: 42,
  title: "Inventory input freezes the game",
  status: "investigating" as const,
  severity: "high" as const,
  build: {
    id: "44444444-4444-4444-8444-444444444444",
    version: "1.2.0",
  },
  reporterDisplayName: "Player One",
  duplicateCount: 2,
  createdAt: "2026-08-17T01:30:00.000Z",
  version: 3,
};

const build = {
  id: report.build.id,
  projectId: project.id,
  version: "1.2.0",
  isActive: true,
  releasedAt: "2026-08-17T00:00:00.000Z",
};

describe("project response DTOs", () => {
  it("accepts project data and list envelopes", () => {
    expect(ProjectSummaryResponseSchema.parse({ data: project })).toEqual({ data: project });
    expect(
      ProjectListResponseSchema.parse({ data: [project], meta: { nextCursor: null } }),
    ).toEqual({ data: [project], meta: { nextCursor: null } });
  });

  it("rejects unknown project fields", () => {
    expect(ProjectSummaryResponseSchema.safeParse({ data: { ...project, secret: true } }).success)
      .toBe(false);
  });
});

describe("report list response DTO", () => {
  it("accepts report list items with pagination metadata", () => {
    expect(
      ReportListResponseSchema.parse({ data: [report], meta: { nextCursor: "opaque" } }),
    ).toEqual({ data: [report], meta: { nextCursor: "opaque" } });
  });

  it("rejects invalid counters and timestamps", () => {
    expect(
      ReportListResponseSchema.safeParse({
        data: [{ ...report, duplicateCount: -1 }],
        meta: { nextCursor: null },
      }).success,
    ).toBe(false);
    expect(
      ReportListResponseSchema.safeParse({
        data: [{ ...report, createdAt: "not-a-date" }],
        meta: { nextCursor: null },
      }).success,
    ).toBe(false);
  });
});

describe("report detail response DTO", () => {
  const detail = {
    ...report,
    fixedBuild: null,
    canonicalReport: null,
    reporterDiscordUserId: "discord-user-1",
    actualResult: "The game stops responding.",
    expectedResult: "The inventory should open.",
    reproductionSteps: "Open inventory during a cutscene.",
    platform: "Windows 11",
    environment: null,
    location: "Dungeon entrance",
    frequency: "3/5",
    attachments: [
      {
        id: "55555555-5555-4555-8555-555555555555",
        originalFilename: "freeze.png",
        contentType: "image/png",
        sizeBytes: 2048,
        sanitizedAt: null,
        createdAt: "2026-08-17T01:31:00.000Z",
      },
    ],
    statusEvents: [
      {
        id: "66666666-6666-4666-8666-666666666666",
        eventType: "report_created" as const,
        fromStatus: null,
        toStatus: "new" as const,
        actor: null,
        note: null,
        createdAt: "2026-08-17T01:30:00.000Z",
      },
    ],
    resolvedAt: null,
    updatedAt: "2026-08-17T01:30:00.000Z",
  };

  it("accepts nullable relations and the data envelope", () => {
    expect(ReportDetailResponseSchema.parse({ data: detail })).toEqual({ data: detail });
  });

  it("rejects fields outside the public detail contract", () => {
    expect(
      ReportDetailResponseSchema.safeParse({
        data: { ...detail, discordInteractionId: "must-not-leak" },
      }).success,
    ).toBe(false);
  });
});

describe("build response DTOs", () => {
  it("accepts active build summaries", () => {
    expect(
      BuildListResponseSchema.parse({ data: [build], meta: { nextCursor: null } }),
    ).toEqual({ data: [build], meta: { nextCursor: null } });
  });

  it("rejects invalid build timestamps", () => {
    expect(
      BuildListResponseSchema.safeParse({
        data: [{ ...build, releasedAt: "today" }],
        meta: { nextCursor: null },
      }).success,
    ).toBe(false);
  });
});
