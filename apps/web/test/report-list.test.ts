import type { Database } from "@reproloop/db/client";
import type { ReportListQuery } from "@reproloop/shared";
import { describe, expect, it, vi } from "vitest";

import type { AuthGuards } from "../src/server/auth/types";
import { decodeReportCursor, encodeReportCursor } from "../src/server/reports/cursor";
import { DrizzleReportListQueryRepository } from "../src/server/reports/drizzle-report-list-query-repository";
import { listAccessibleProjectReports } from "../src/server/reports/service";
import type { ReportListQueryRepository } from "../src/server/reports/types";

const projectId = "11111111-1111-4111-8111-111111111111";
const firstReportId = "22222222-2222-4222-8222-222222222222";
const secondReportId = "33333333-3333-4333-8333-333333333333";
const createdAt = new Date("2026-08-17T01:30:00.000Z");
const query: ReportListQuery = { limit: 1 };

describe("report cursor", () => {
  it("round-trips a stable createdAt and report ID cursor", () => {
    const encoded = encodeReportCursor({ createdAt, id: firstReportId });
    expect(decodeReportCursor(encoded)).toEqual({ createdAt, id: firstReportId });
  });

  it("rejects malformed cursors as validation errors", () => {
    expect(() => decodeReportCursor("not-a-cursor")).toThrowError(
      expect.objectContaining({ code: "VALIDATION_ERROR" }),
    );
  });
});

describe("report list access", () => {
  it("checks project membership before querying reports", async () => {
    const guards = {
      requireProjectMember: vi.fn(async () => ({ projectId })),
    } as unknown as AuthGuards;
    const page = { items: [], nextCursor: null };
    const repository = {
      listProjectReports: vi.fn(async () => page),
    } as unknown as ReportListQueryRepository;

    await expect(
      listAccessibleProjectReports(guards, repository, projectId, query),
    ).resolves.toEqual(page);
    expect(guards.requireProjectMember).toHaveBeenCalledWith(projectId);
    expect(repository.listProjectReports).toHaveBeenCalledWith({ projectId, query });
  });
});

describe("DrizzleReportListQueryRepository", () => {
  it("maps rows to DTOs and creates a cursor when another row exists", async () => {
    const rows = [
      {
        id: firstReportId,
        projectId,
        reportNumber: 2,
        title: "Inventory input freezes the game",
        status: "new" as const,
        severity: "high" as const,
        buildId: "44444444-4444-4444-8444-444444444444",
        buildVersion: "1.2.0",
        reporterDisplayName: "Player One",
        duplicateCount: 3,
        createdAt,
        version: 0,
      },
      {
        id: secondReportId,
        projectId,
        reportNumber: 1,
        title: "Older report",
        status: "investigating" as const,
        severity: "medium" as const,
        buildId: "55555555-5555-4555-8555-555555555555",
        buildVersion: "1.1.0",
        reporterDisplayName: "Player Two",
        duplicateCount: 0,
        createdAt: new Date("2026-08-16T01:30:00.000Z"),
        version: 1,
      },
    ];
    const limit = vi.fn(async () => rows);
    const orderBy = vi.fn(() => ({ limit }));
    const groupBy = vi.fn(() => ({ orderBy }));
    const where = vi.fn(() => ({ groupBy }));
    const leftJoin = vi.fn(() => ({ where }));
    const innerJoin = vi.fn(() => ({ leftJoin }));
    const from = vi.fn(() => ({ innerJoin }));
    const select = vi.fn(() => ({ from }));
    const repository = new DrizzleReportListQueryRepository({ select } as unknown as Database);

    const page = await repository.listProjectReports({ projectId, query });

    expect(page.items).toEqual([
      {
        id: firstReportId,
        projectId,
        reportNumber: 2,
        title: "Inventory input freezes the game",
        status: "new",
        severity: "high",
        build: { id: rows[0]!.buildId, version: "1.2.0" },
        reporterDisplayName: "Player One",
        duplicateCount: 3,
        createdAt: createdAt.toISOString(),
        version: 0,
      },
    ]);
    expect(decodeReportCursor(page.nextCursor!)).toEqual({
      createdAt,
      id: firstReportId,
    });
    expect(limit).toHaveBeenCalledWith(2);
  });
});
