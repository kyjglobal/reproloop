import { describe, expect, it } from "vitest";

import {
  ReportDomainError,
  validateDuplicateMerge,
  validateDuplicateUnmerge,
} from "../src/index.js";
import type { ReportSnapshot } from "../src/index.js";

const projectId = "0198e9d1-c451-76ac-8e87-95dbf12d51fe";
const targetId = "0198e9d1-c451-76ac-8e87-95dbf12d51fd";
const canonicalId = "0198e9d1-c451-76ac-8e87-95dbf12d51ff";

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

function expectDomainError(run: () => unknown, code: ReportDomainError["code"]): void {
  try {
    run();
    throw new Error("Expected ReportDomainError");
  } catch (error) {
    expect(error).toBeInstanceOf(ReportDomainError);
    expect((error as ReportDomainError).code).toBe(code);
  }
}

describe("duplicate report rules", () => {
  it.each(["new", "needs_info", "investigating", "reproduced"] as const)(
    "DM-S01/S02 merges a %s report",
    (status) => {
      const decision = validateDuplicateMerge({
        target: report(targetId, { status }),
        canonical: report(canonicalId),
        actorRole: "admin",
        expectedVersion: 3,
      });

      expect(decision).toEqual({
        previousStatus: status,
        nextStatus: "duplicate",
        canonicalReportId: canonicalId,
        eventType: "duplicate_merged",
        nextVersion: 4,
      });
    },
  );

  it("DM-S03 restores the state saved before a merge", () => {
    const decision = validateDuplicateUnmerge({
      target: report(targetId, { status: "duplicate", canonicalReportId: canonicalId }),
      actorRole: "owner",
      expectedVersion: 3,
      previousStatusBeforeDuplicate: "investigating",
    });

    expect(decision).toEqual({
      previousStatus: "duplicate",
      nextStatus: "investigating",
      canonicalReportId: null,
      eventType: "duplicate_unmerged",
      nextVersion: 4,
    });
  });

  it("DM-F01 rejects a self-reference", () => {
    expectDomainError(
      () =>
        validateDuplicateMerge({
          target: report(targetId),
          canonical: report(targetId),
          actorRole: "admin",
          expectedVersion: 3,
        }),
      "VALIDATION_ERROR",
    );
  });

  it("DM-F02 hides a report from another project", () => {
    expectDomainError(
      () =>
        validateDuplicateMerge({
          target: report(targetId),
          canonical: report(canonicalId, {
            projectId: "0198e9d1-c451-76ac-8e87-95dbf12d5200",
          }),
          actorRole: "admin",
          expectedVersion: 3,
        }),
      "NOT_FOUND",
    );
  });

  it("DM-F03 rejects an already duplicate canonical report", () => {
    expectDomainError(
      () =>
        validateDuplicateMerge({
          target: report(targetId),
          canonical: report(canonicalId, {
            status: "duplicate",
            canonicalReportId: "0198e9d1-c451-76ac-8e87-95dbf12d5201",
          }),
          actorRole: "admin",
          expectedVersion: 3,
        }),
      "CONFLICT",
    );
  });

  it("DM-F04/F05 rejects a circular relationship", () => {
    expectDomainError(
      () =>
        validateDuplicateMerge({
          target: report(targetId),
          canonical: report(canonicalId),
          actorRole: "admin",
          expectedVersion: 3,
          canonicalAncestorIds: [targetId],
        }),
      "CONFLICT",
    );
  });

  it("DM-F06 rejects merging an already duplicate target", () => {
    expectDomainError(
      () =>
        validateDuplicateMerge({
          target: report(targetId, { status: "duplicate", canonicalReportId: canonicalId }),
          canonical: report(canonicalId),
          actorRole: "admin",
          expectedVersion: 3,
        }),
      "INVALID_STATUS_TRANSITION",
    );
  });

  it("DM-F07 rejects unmerging a regular report", () => {
    expectDomainError(
      () =>
        validateDuplicateUnmerge({
          target: report(targetId),
          actorRole: "admin",
          expectedVersion: 3,
          previousStatusBeforeDuplicate: "new",
        }),
      "INVALID_STATUS_TRANSITION",
    );
  });

  it("DM-F08 rejects an unmerge without the previous state", () => {
    expectDomainError(
      () =>
        validateDuplicateUnmerge({
          target: report(targetId, { status: "duplicate", canonicalReportId: canonicalId }),
          actorRole: "admin",
          expectedVersion: 3,
          previousStatusBeforeDuplicate: null,
        }),
      "CONFLICT",
    );
  });

  it("DM-F09 rejects a stale expectedVersion", () => {
    expectDomainError(
      () =>
        validateDuplicateMerge({
          target: report(targetId, { version: 4 }),
          canonical: report(canonicalId),
          actorRole: "admin",
          expectedVersion: 3,
        }),
      "CONFLICT",
    );
  });

  it("DM-F10 prevents a member from merging reports", () => {
    expectDomainError(
      () =>
        validateDuplicateMerge({
          target: report(targetId),
          canonical: report(canonicalId),
          actorRole: "member",
          expectedVersion: 3,
        }),
      "FORBIDDEN",
    );
  });

  it("DM-F11 rejects soft-deleted reports", () => {
    expectDomainError(
      () =>
        validateDuplicateMerge({
          target: report(targetId),
          canonical: report(canonicalId, { deletedAt: new Date() }),
          actorRole: "owner",
          expectedVersion: 3,
        }),
      "NOT_FOUND",
    );
  });
});
