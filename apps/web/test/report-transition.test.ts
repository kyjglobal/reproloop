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
const canonicalReportId = "55555555-5555-4555-8555-555555555555";
const buildId = "66666666-6666-4666-8666-666666666666";
const statusEventId = "77777777-7777-4777-8777-777777777777";

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
  const targetReport = { ...report, ...reportOverride };
  const canonicalReport: ReportSnapshot = {
    ...report,
    id: canonicalReportId,
    version: 0,
  };
  const transaction: ReportTransaction = {
    findById: vi.fn(async (id) =>
      id === reportId ? targetReport : id === canonicalReportId ? canonicalReport : null,
    ),
    findBuildProjectId: vi.fn(async () => projectId),
    listCanonicalAncestorIds: vi.fn(async () => []),
    listRelatedReporterDiscordUserIds: vi.fn(async () => ["reporter-1", "reporter-1", "reporter-2"]),
    findLatestDuplicateHistoryEvent: vi.fn(async () => ({
      eventType: "duplicate_merged" as const,
      metadata: { previousStatus: "new" },
    })),
    updateReport: vi.fn(async () => undefined),
    addStatusEvent: vi.fn(async () => statusEventId),
    addNotifications: vi.fn(async () => []),
  };
  const reportRepository: ReportRepository = {
    findById: vi.fn(async () => targetReport),
    listCanonicalAncestorIds: vi.fn(async () => []),
    listRelatedReporterDiscordUserIds: vi.fn(async () => []),
    transaction: vi.fn(async (work) => work(transaction)),
  };
  const guards = {
    requireProjectMember: vi.fn(async () => ({
      projectId,
      organizationId,
      userId,
      role: "admin" as const,
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

  it("routes merge_duplicate to the B transaction service", async () => {
    const { dependencies, transaction } = createDependencies();

    await expect(
      dispatchReportTransition(dependencies, reportId, {
        action: "merge_duplicate",
        canonicalReportId,
        expectedVersion: 2,
      }),
    ).resolves.toEqual({
      reportId,
      action: "merge_duplicate",
      previousStatus: "new",
      status: "duplicate",
      version: 3,
    });
    expect(transaction.updateReport).toHaveBeenCalledWith({
      reportId,
      expectedVersion: 2,
      status: "duplicate",
      canonicalReportId,
    });
  });

  it("routes unmerge_duplicate and restores the event-recorded status", async () => {
    const { dependencies, transaction } = createDependencies({
      status: "duplicate",
      canonicalReportId,
    });

    await expect(
      dispatchReportTransition(dependencies, reportId, {
        action: "unmerge_duplicate",
        expectedVersion: 2,
      }),
    ).resolves.toMatchObject({
      action: "unmerge_duplicate",
      previousStatus: "duplicate",
      status: "new",
      version: 3,
    });
    expect(transaction.updateReport).toHaveBeenCalledWith({
      reportId,
      expectedVersion: 2,
      status: "new",
      canonicalReportId: null,
    });
  });

  it("marks a reproduced report fixed and queues one notification per reporter", async () => {
    const { dependencies, transaction } = createDependencies({ status: "reproduced" });

    await expect(
      dispatchReportTransition(dependencies, reportId, {
        action: "mark_fixed",
        fixedBuildId: buildId,
        note: "1.2.0에서 수정",
        expectedVersion: 2,
      }),
    ).resolves.toEqual({
      reportId,
      action: "mark_fixed",
      previousStatus: "reproduced",
      status: "fixed",
      version: 3,
    });

    expect(transaction.updateReport).toHaveBeenCalledWith({
      reportId,
      expectedVersion: 2,
      status: "fixed",
      fixedBuildId: buildId,
      resolvedAt: expect.any(Date),
    });
    expect(transaction.addStatusEvent).toHaveBeenCalledWith({
      reportId,
      eventType: "report_fixed",
      fromStatus: "reproduced",
      toStatus: "fixed",
      actorId: userId,
      note: "1.2.0에서 수정",
      metadata: { fixedBuildId: buildId },
    });
    expect(transaction.addNotifications).toHaveBeenCalledWith({
      reportId,
      statusEventId,
      type: "report_fixed",
      recipientDiscordUserIds: ["reporter-1", "reporter-2"],
    });
  });

  it("rejects mark_fixed when the selected build belongs to another project", async () => {
    const { dependencies, transaction } = createDependencies({ status: "reproduced" });
    vi.mocked(transaction.findBuildProjectId).mockResolvedValue(canonicalReportId);

    await expect(
      dispatchReportTransition(dependencies, reportId, {
        action: "mark_fixed",
        fixedBuildId: buildId,
        expectedVersion: 2,
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(transaction.updateReport).not.toHaveBeenCalled();
  });

  it("keeps mark_fixed forbidden for a member", async () => {
    const { dependencies, guards, transaction } = createDependencies({
      status: "reproduced",
    });
    vi.mocked(guards.requireProjectMember).mockResolvedValue({
      projectId,
      organizationId,
      userId,
      role: "member",
    });

    await expect(
      dispatchReportTransition(dependencies, reportId, {
        action: "mark_fixed",
        fixedBuildId: buildId,
        expectedVersion: 2,
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(transaction.updateReport).not.toHaveBeenCalled();
  });

  it("keeps duplicate mutations forbidden for a member", async () => {
    const { dependencies, guards, reportRepository } = createDependencies();
    vi.mocked(guards.requireProjectMember).mockResolvedValue({
      projectId,
      organizationId,
      userId,
      role: "member",
    });

    await expect(
      dispatchReportTransition(dependencies, reportId, {
        action: "merge_duplicate",
        canonicalReportId,
        expectedVersion: 2,
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(reportRepository.transaction).toHaveBeenCalledOnce();
    expect(dependencies.reportRepository.findById).toHaveBeenCalledWith(reportId);
  });
});
