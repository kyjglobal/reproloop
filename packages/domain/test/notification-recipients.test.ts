import { describe, expect, it } from "vitest";

import {
  buildReportFixedNotificationIdempotencyKey,
  buildReportFixedNotificationInputs,
  collectNotificationRecipientIds,
  createNotificationSendJobV1,
  resolveReportFixNotificationAudience,
  type ReportNotificationRecipientReader,
  type ReportSnapshot,
} from "../src/index.js";

const projectId = "11111111-1111-4111-8111-111111111111";
const canonicalReportId = "22222222-2222-4222-8222-222222222222";
const duplicateReportId = "33333333-3333-4333-8333-333333333333";
const statusEventId = "44444444-4444-4444-8444-444444444444";
const notificationId = "55555555-5555-4555-8555-555555555555";

function report(id: string, overrides: Partial<ReportSnapshot> = {}): ReportSnapshot {
  return {
    id,
    projectId,
    status: "new",
    version: 0,
    canonicalReportId: null,
    fixedBuildId: null,
    deletedAt: null,
    ...overrides,
  };
}

describe("notification recipients", () => {
  it("DM-S04/S05 returns unique non-empty Discord user IDs", () => {
    expect(
      collectNotificationRecipientIds([
        "100",
        "200",
        " 100 ",
        null,
        undefined,
        "",
        "   ",
      ]),
    ).toEqual(["100", "200"]);
  });

  it("resolves the same audience from a canonical or duplicate report", async () => {
    const canonical = report(canonicalReportId);
    const duplicate = report(duplicateReportId, {
      status: "duplicate",
      canonicalReportId,
    });
    const reader: ReportNotificationRecipientReader = {
      findById: async (id) =>
        id === canonicalReportId ? canonical : id === duplicateReportId ? duplicate : null,
      listRelatedReportReporters: async () => [
        { reportId: canonicalReportId, reporterDiscordUserId: "100" },
        { reportId: duplicateReportId, reporterDiscordUserId: "200" },
        {
          reportId: "66666666-6666-4666-8666-666666666666",
          reporterDiscordUserId: "100",
        },
      ],
    };

    const expected = {
      canonicalReportId,
      relatedReportIds: [
        canonicalReportId,
        duplicateReportId,
        "66666666-6666-4666-8666-666666666666",
      ],
      recipientDiscordUserIds: ["100", "200"],
    };

    await expect(
      resolveReportFixNotificationAudience(reader, canonicalReportId),
    ).resolves.toEqual(expected);
    await expect(
      resolveReportFixNotificationAudience(reader, duplicateReportId),
    ).resolves.toEqual(expected);
  });

  it("rejects a deleted input or unavailable canonical report", async () => {
    const deletedReader: ReportNotificationRecipientReader = {
      findById: async () => report(duplicateReportId, { deletedAt: new Date() }),
      listRelatedReportReporters: async () => [],
    };
    await expect(
      resolveReportFixNotificationAudience(deletedReader, duplicateReportId),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });

    const missingCanonicalReader: ReportNotificationRecipientReader = {
      findById: async (id) =>
        id === duplicateReportId
          ? report(duplicateReportId, {
              status: "duplicate",
              canonicalReportId,
            })
          : null,
      listRelatedReportReporters: async () => [],
    };
    await expect(
      resolveReportFixNotificationAudience(missingCanonicalReader, duplicateReportId),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("builds one stable notification input per unique recipient", () => {
    expect(
      buildReportFixedNotificationInputs(
        {
          canonicalReportId,
          relatedReportIds: [canonicalReportId, duplicateReportId],
          recipientDiscordUserIds: ["100", "200"],
        },
        statusEventId,
      ),
    ).toEqual([
      {
        reportId: canonicalReportId,
        statusEventId,
        recipientDiscordUserId: "100",
        type: "report_fixed",
        idempotencyKey: `${statusEventId}:report_fixed:100`,
      },
      {
        reportId: canonicalReportId,
        statusEventId,
        recipientDiscordUserId: "200",
        type: "report_fixed",
        idempotencyKey: `${statusEventId}:report_fixed:200`,
      },
    ]);
    expect(
      buildReportFixedNotificationIdempotencyKey({
        statusEventId,
        recipientDiscordUserId: "100",
      }),
    ).toBe(`${statusEventId}:report_fixed:100`);
  });

  it("creates a job payload accepted by the shared V1 contract", () => {
    expect(createNotificationSendJobV1(notificationId)).toEqual({
      jobName: "notification.send.v1",
      version: 1,
      notificationId,
    });
  });
});
