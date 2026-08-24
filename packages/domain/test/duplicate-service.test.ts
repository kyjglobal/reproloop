import { describe, expect, it, vi } from "vitest";

import {
  mergeDuplicateReport,
  ReportDomainError,
  unmergeDuplicateReport,
  type ReportRepository,
  type ReportSnapshot,
  type ReportTransaction,
} from "../src/index.js";

const projectId = "11111111-1111-4111-8111-111111111111";
const targetId = "22222222-2222-4222-8222-222222222222";
const canonicalId = "33333333-3333-4333-8333-333333333333";
const actorId = "44444444-4444-4444-8444-444444444444";

function report(id: string, overrides: Partial<ReportSnapshot> = {}): ReportSnapshot {
  return {
    id,
    projectId,
    status: "new",
    version: 3,
    canonicalReportId: null,
    fixedBuildId: null,
    deletedAt: null,
    ...overrides,
  };
}

function createRepository(transaction: ReportTransaction): ReportRepository {
  return {
    findById: vi.fn(),
    listCanonicalAncestorIds: vi.fn(),
    listRelatedReporterDiscordUserIds: vi.fn(),
    transaction: vi.fn((work) => work(transaction)),
  };
}

describe("duplicate transaction service", () => {
  it("persists the merge and its restoration metadata in one transaction", async () => {
    const target = report(targetId, { status: "investigating" });
    const canonical = report(canonicalId);
    const updateReport = vi.fn(async () => undefined);
    const addStatusEvent = vi.fn(async () => undefined);
    const transaction = {
      findById: vi.fn(async (id: string) => (id === targetId ? target : canonical)),
      listCanonicalAncestorIds: vi.fn(async () => []),
      findLatestDuplicateHistoryEvent: vi.fn(),
      updateReport,
      addStatusEvent,
    } as ReportTransaction;

    await expect(
      mergeDuplicateReport(createRepository(transaction), {
        targetReportId: targetId,
        canonicalReportId: canonicalId,
        actorId,
        actorRole: "admin",
        expectedVersion: 3,
        note: "same crash",
      }),
    ).resolves.toEqual({
      reportId: targetId,
      previousStatus: "investigating",
      nextStatus: "duplicate",
      canonicalReportId: canonicalId,
      version: 4,
    });
    expect(updateReport).toHaveBeenCalledWith({
      reportId: targetId,
      expectedVersion: 3,
      status: "duplicate",
      canonicalReportId: canonicalId,
    });
    expect(addStatusEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "duplicate_merged",
        metadata: { previousStatus: "investigating", canonicalReportId: canonicalId },
      }),
    );
  });

  it("restores only the status recorded by the latest merge event", async () => {
    const target = report(targetId, {
      status: "duplicate",
      canonicalReportId: canonicalId,
    });
    const updateReport = vi.fn(async () => undefined);
    const addStatusEvent = vi.fn(async () => undefined);
    const transaction = {
      findById: vi.fn(async () => target),
      listCanonicalAncestorIds: vi.fn(),
      findLatestDuplicateHistoryEvent: vi.fn(async () => ({
        eventType: "duplicate_merged" as const,
        metadata: { previousStatus: "reproduced", canonicalReportId: canonicalId },
      })),
      updateReport,
      addStatusEvent,
    } as ReportTransaction;

    await expect(
      unmergeDuplicateReport(createRepository(transaction), {
        targetReportId: targetId,
        actorId,
        actorRole: "owner",
        expectedVersion: 3,
      }),
    ).resolves.toMatchObject({
      nextStatus: "reproduced",
      canonicalReportId: null,
      version: 4,
    });
    expect(updateReport).toHaveBeenCalledWith(
      expect.objectContaining({ status: "reproduced", canonicalReportId: null }),
    );
  });

  it("does not mutate an already-unmerged report or one with invalid history", async () => {
    const transaction = {
      findById: vi.fn(async () =>
        report(targetId, { status: "duplicate", canonicalReportId: canonicalId }),
      ),
      listCanonicalAncestorIds: vi.fn(),
      findLatestDuplicateHistoryEvent: vi.fn(async () => ({
        eventType: "duplicate_unmerged" as const,
        metadata: { restoredStatus: "new" },
      })),
      updateReport: vi.fn(),
      addStatusEvent: vi.fn(),
    } as ReportTransaction;

    await expect(
      unmergeDuplicateReport(createRepository(transaction), {
        targetReportId: targetId,
        actorId,
        actorRole: "admin",
        expectedVersion: 3,
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" } satisfies Partial<ReportDomainError>);
    expect(transaction.updateReport).not.toHaveBeenCalled();
    expect(transaction.addStatusEvent).not.toHaveBeenCalled();
  });
});
