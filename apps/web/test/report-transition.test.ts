import type {
  ReportRepository,
  ReportSnapshot,
  ReportTransaction,
} from "@reproloop/domain";
import { describe, expect, it, vi } from "vitest";

import { AuthAccessError } from "../src/server/auth/errors";
import type { AuthGuards } from "../src/server/auth/types";
import { transitionReportStatus } from "../src/server/reports/service";
import { dispatchReportTransition } from "../src/server/reports/transition-dispatcher";
import type { ReportTransitionDependencies } from "../src/server/reports/types";

const userId = "11111111-1111-4111-8111-111111111111";
const organizationId = "22222222-2222-4222-8222-222222222222";
const projectId = "33333333-3333-4333-8333-333333333333";
const reportId = "44444444-4444-4444-8444-444444444444";

const report: ReportSnapshot = {
  id: reportId,
  projectId,
  status: "new",
  version: 2,
  canonicalReportId: null,
  fixedBuildId: null,
  deletedAt: null,
};

function createDependencies(reportOverride: Partial<ReportSnapshot> = {}) {
  const transaction: ReportTransaction = {
    updateReport: vi.fn(async () => undefined),
    addStatusEvent: vi.fn(async () => undefined),
  };
  const reportRepository: ReportRepository = {
    findById: vi.fn(async () => ({ ...report, ...reportOverride })),
    listCanonicalAncestorIds: vi.fn(async () => []),
    listRelatedReporterDiscordUserIds: vi.fn(async () => []),
    transaction: vi.fn(async (work) => work(transaction)),
  };
  const guards = {
    requireProjectMember: vi.fn(async () => ({
      projectId,
      organizationId,
      userId,
      role: "member" as const,
    })),
  } as unknown as AuthGuards;

  return {
    dependencies: { guards, reportRepository } satisfies ReportTransitionDependencies,
    guards,
    reportRepository,
    transaction,
  };
}

describe("report status transition service", () => {
  it("updates the report and writes the status event in one repository transaction", async () => {
    const { dependencies, guards, reportRepository, transaction } = createDependencies();

    await expect(
      transitionReportStatus(dependencies, reportId, {
        action: "request_information",
        message: "그래픽 설정을 알려주세요.",
        expectedVersion: 2,
      }),
    ).resolves.toEqual({
      reportId,
      action: "request_information",
      previousStatus: "new",
      status: "needs_info",
      version: 3,
    });

    expect(guards.requireProjectMember).toHaveBeenCalledWith(projectId);
    expect(reportRepository.transaction).toHaveBeenCalledOnce();
    expect(transaction.updateReport).toHaveBeenCalledWith({
      reportId,
      expectedVersion: 2,
      status: "needs_info",
    });
    expect(transaction.addStatusEvent).toHaveBeenCalledWith({
      reportId,
      eventType: "information_requested",
      fromStatus: "new",
      toStatus: "needs_info",
      actorId: userId,
      note: "그래픽 설정을 알려주세요.",
    });
  });

  it("does not start a transaction when expectedVersion is stale", async () => {
    const { dependencies, reportRepository } = createDependencies({ version: 3 });

    await expect(
      transitionReportStatus(dependencies, reportId, {
        action: "start_investigation",
        expectedVersion: 2,
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    expect(reportRepository.transaction).not.toHaveBeenCalled();
  });

  it("rejects an action that is unavailable from the current status", async () => {
    const { dependencies, reportRepository } = createDependencies({
      status: "needs_info",
    });

    await expect(
      transitionReportStatus(dependencies, reportId, {
        action: "mark_reproduced",
        expectedVersion: 2,
      }),
    ).rejects.toMatchObject({ code: "INVALID_STATUS_TRANSITION" });
    expect(reportRepository.transaction).not.toHaveBeenCalled();
  });

  it("preserves project access failures", async () => {
    const { dependencies, guards, reportRepository } = createDependencies();
    vi.mocked(guards.requireProjectMember).mockRejectedValue(
      new AuthAccessError("FORBIDDEN", "프로젝트 권한이 없습니다."),
    );

    await expect(
      transitionReportStatus(dependencies, reportId, {
        action: "start_investigation",
        expectedVersion: 2,
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(reportRepository.transaction).not.toHaveBeenCalled();
  });

  it("returns NOT_FOUND before checking access when the report does not exist", async () => {
    const { dependencies, guards, reportRepository } = createDependencies();
    vi.mocked(reportRepository.findById).mockResolvedValue(null);

    await expect(
      transitionReportStatus(dependencies, reportId, {
        action: "start_investigation",
        expectedVersion: 2,
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(guards.requireProjectMember).not.toHaveBeenCalled();
  });
});

describe("report transition dispatcher", () => {
  it("routes A status actions to the status handler", async () => {
    const { dependencies } = createDependencies();

    await expect(
      dispatchReportTransition(dependencies, reportId, {
        action: "start_investigation",
        note: "담당자 배정",
        expectedVersion: 2,
      }),
    ).resolves.toMatchObject({ status: "investigating", version: 3 });
  });

  it.each(["merge_duplicate", "unmerge_duplicate"] as const)(
    "keeps %s behind the B handler boundary",
    async (action) => {
      const { dependencies, reportRepository } = createDependencies();

      const transition =
        action === "merge_duplicate"
          ? {
              action,
              canonicalReportId: "55555555-5555-4555-8555-555555555555",
              expectedVersion: 2,
            }
          : { action, expectedVersion: 2 };

      await expect(
        dispatchReportTransition(dependencies, reportId, transition),
      ).rejects.toMatchObject({ code: "INVALID_STATUS_TRANSITION" });
      expect(reportRepository.findById).not.toHaveBeenCalled();
    },
  );
});
