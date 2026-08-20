import type { ReportDetail } from "@reproloop/shared";
import { describe, expect, it, vi } from "vitest";

import type { AuthGuards } from "../src/server/auth/types";
import { AuthAccessError } from "../src/server/auth/errors";
import { getAccessibleReportDetail } from "../src/server/reports/service";
import type { ReportDetailQueryRepository } from "../src/server/reports/types";

const projectId = "11111111-1111-4111-8111-111111111111";
const reportId = "22222222-2222-4222-8222-222222222222";

const detail: ReportDetail = {
  id: reportId,
  projectId,
  reportNumber: 7,
  title: "Inventory input freezes the game",
  status: "investigating",
  severity: "high",
  build: { id: "33333333-3333-4333-8333-333333333333", version: "1.2.0" },
  fixedBuild: null,
  canonicalReport: null,
  reporterDiscordUserId: "discord-user-1",
  reporterDisplayName: "Player One",
  actualResult: "The game stops responding.",
  expectedResult: "The inventory should open.",
  reproductionSteps: "Open inventory during a cutscene.",
  platform: "Windows 11",
  environment: null,
  location: null,
  frequency: "3/5",
  duplicateCount: 0,
  attachments: [],
  statusEvents: [],
  resolvedAt: null,
  createdAt: "2026-08-17T01:30:00.000Z",
  updatedAt: "2026-08-17T01:30:00.000Z",
  version: 1,
};

function createDependencies(overrides: Partial<ReportDetailQueryRepository> = {}) {
  const guards = {
    requireProjectMember: vi.fn(async () => ({ projectId })),
  } as unknown as AuthGuards;
  const repository: ReportDetailQueryRepository = {
    findReportProjectId: vi.fn(async () => projectId),
    findReportDetail: vi.fn(async () => detail),
    ...overrides,
  };

  return { guards, repository };
}

describe("report detail access", () => {
  it("checks project membership before returning the detail", async () => {
    const { guards, repository } = createDependencies();

    await expect(
      getAccessibleReportDetail(guards, repository, reportId, projectId),
    ).resolves.toEqual(detail);
    expect(repository.findReportProjectId).toHaveBeenCalledWith(reportId);
    expect(guards.requireProjectMember).toHaveBeenCalledWith(projectId);
    expect(repository.findReportDetail).toHaveBeenCalledWith(reportId);
  });

  it("returns NOT_FOUND for a deleted or missing report without checking membership", async () => {
    const { guards, repository } = createDependencies({
      findReportProjectId: vi.fn(async () => null),
    });

    await expect(getAccessibleReportDetail(guards, repository, reportId)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    expect(guards.requireProjectMember).not.toHaveBeenCalled();
  });

  it("hides a report reached through a different project URL", async () => {
    const { guards, repository } = createDependencies();
    const otherProjectId = "44444444-4444-4444-8444-444444444444";

    await expect(
      getAccessibleReportDetail(guards, repository, reportId, otherProjectId),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(guards.requireProjectMember).not.toHaveBeenCalled();
  });

  it("does not return a report that disappears after the access check", async () => {
    const { guards, repository } = createDependencies({
      findReportDetail: vi.fn(async () => null),
    });

    await expect(getAccessibleReportDetail(guards, repository, reportId)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it.each([
    ["UNAUTHENTICATED", "로그인이 필요합니다."],
    ["FORBIDDEN", "프로젝트 권한이 없습니다."],
  ] as const)("preserves %s access failures", async (code, message) => {
    const { guards, repository } = createDependencies();
    vi.mocked(guards.requireProjectMember).mockRejectedValue(
      new AuthAccessError(code, message),
    );

    await expect(getAccessibleReportDetail(guards, repository, reportId)).rejects.toMatchObject({
      code,
      message,
    });
    expect(repository.findReportDetail).not.toHaveBeenCalled();
  });
});
