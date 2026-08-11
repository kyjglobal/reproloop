import { describe, expect, it } from "vitest";

import { ReportDomainError, validateReportTransition } from "../src/index.js";
import type { ReportSnapshot } from "../src/index.js";

const reportId = "0198e9d1-c451-76ac-8e87-95dbf12d51fd";
const projectId = "0198e9d1-c451-76ac-8e87-95dbf12d51fe";
const buildId = "0198e9d1-c451-76ac-8e87-95dbf12d51ff";

function report(overrides: Partial<ReportSnapshot> = {}): ReportSnapshot {
  return {
    id: reportId,
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

describe("report state transitions", () => {
  it("ST-S01 requests information and creates a notification", () => {
    const decision = validateReportTransition({
      report: report(),
      actorRole: "member",
      transition: {
        action: "request_information",
        message: "그래픽 설정을 알려주세요.",
        expectedVersion: 3,
      },
    });

    expect(decision).toMatchObject({
      nextStatus: "needs_info",
      eventType: "information_requested",
      nextVersion: 4,
      createsNotification: true,
    });
  });

  it.each([
    ["new", "start_investigation", "investigating", "investigation_started"],
    ["new", "mark_reproduced", "reproduced", "report_reproduced"],
    ["needs_info", "start_investigation", "investigating", "investigation_started"],
    ["investigating", "mark_reproduced", "reproduced", "report_reproduced"],
  ] as const)("allows %s + %s", (status, action, nextStatus, eventType) => {
    const decision = validateReportTransition({
      report: report({ status }),
      actorRole: "member",
      transition: { action, expectedVersion: 3 },
    });

    expect(decision).toMatchObject({ nextStatus, eventType, nextVersion: 4 });
  });

  it("ST-S07 fixes a reproduced report with a project build", () => {
    const decision = validateReportTransition({
      report: report({ status: "reproduced" }),
      actorRole: "admin",
      transition: { action: "mark_fixed", fixedBuildId: buildId, expectedVersion: 3 },
      fixedBuildProjectId: projectId,
    });

    expect(decision).toMatchObject({
      nextStatus: "fixed",
      eventType: "report_fixed",
      fixedBuildId: buildId,
      createsNotification: true,
    });
  });

  it("ST-F01 rejects new to fixed", () => {
    expectDomainError(
      () =>
        validateReportTransition({
          report: report(),
          actorRole: "admin",
          transition: { action: "mark_fixed", fixedBuildId: buildId, expectedVersion: 3 },
          fixedBuildProjectId: projectId,
        }),
      "INVALID_STATUS_TRANSITION",
    );
  });

  it("ST-F02 treats fixed as terminal", () => {
    expectDomainError(
      () =>
        validateReportTransition({
          report: report({ status: "fixed" }),
          actorRole: "admin",
          transition: { action: "start_investigation", expectedVersion: 3 },
        }),
      "INVALID_STATUS_TRANSITION",
    );
  });

  it("ST-F07 rejects a stale expectedVersion", () => {
    expectDomainError(
      () =>
        validateReportTransition({
          report: report({ version: 4 }),
          actorRole: "admin",
          transition: { action: "start_investigation", expectedVersion: 3 },
        }),
      "CONFLICT",
    );
  });

  it("ST-F08 prevents a member from fixing a report", () => {
    expectDomainError(
      () =>
        validateReportTransition({
          report: report({ status: "reproduced" }),
          actorRole: "member",
          transition: { action: "mark_fixed", fixedBuildId: buildId, expectedVersion: 3 },
          fixedBuildProjectId: projectId,
        }),
      "FORBIDDEN",
    );
  });

  it("ST-F06 hides a build from another project", () => {
    expectDomainError(
      () =>
        validateReportTransition({
          report: report({ status: "reproduced" }),
          actorRole: "owner",
          transition: { action: "mark_fixed", fixedBuildId: buildId, expectedVersion: 3 },
          fixedBuildProjectId: "0198e9d1-c451-76ac-8e87-95dbf12d5200",
        }),
      "NOT_FOUND",
    );
  });

  it("rejects a soft-deleted report", () => {
    expectDomainError(
      () =>
        validateReportTransition({
          report: report({ deletedAt: new Date() }),
          actorRole: "owner",
          transition: { action: "start_investigation", expectedVersion: 3 },
        }),
      "NOT_FOUND",
    );
  });
});
