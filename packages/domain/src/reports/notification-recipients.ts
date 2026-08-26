import {
  NotificationSendJobV1Schema,
  type NotificationSendJobV1,
} from "@reproloop/shared";

import { ReportDomainError } from "../errors.js";
import type { ReportNotificationRecipientReader } from "./report-repository.js";
import type { ReportFixNotificationAudience } from "./types.js";

export function collectNotificationRecipientIds(
  reporterDiscordUserIds: readonly (string | null | undefined)[],
): string[] {
  return [
    ...new Set(
      reporterDiscordUserIds
        .filter((value): value is string => typeof value === "string")
        .map((value) => value.trim())
        .filter(Boolean),
    ),
  ];
}

export async function resolveReportFixNotificationAudience(
  reader: ReportNotificationRecipientReader,
  reportId: string,
): Promise<ReportFixNotificationAudience> {
  const report = await reader.findById(reportId);
  if (!report || report.deletedAt) {
    throw new ReportDomainError("NOT_FOUND", "제보를 찾을 수 없습니다.");
  }

  const canonicalReportId = report.canonicalReportId ?? report.id;
  const canonicalReport =
    canonicalReportId === report.id ? report : await reader.findById(canonicalReportId);
  if (
    !canonicalReport ||
    canonicalReport.deletedAt ||
    canonicalReport.projectId !== report.projectId
  ) {
    throw new ReportDomainError("NOT_FOUND", "대표 제보를 찾을 수 없습니다.");
  }

  const relatedReporters = await reader.listRelatedReportReporters(canonicalReportId);

  return {
    canonicalReportId,
    relatedReportIds: [...new Set(relatedReporters.map(({ reportId: id }) => id))],
    recipientDiscordUserIds: collectNotificationRecipientIds(
      relatedReporters.map(({ reporterDiscordUserId }) => reporterDiscordUserId),
    ),
  };
}

export function buildReportFixedNotificationIdempotencyKey(input: {
  statusEventId: string;
  recipientDiscordUserId: string;
}): string {
  return `${input.statusEventId}:report_fixed:${input.recipientDiscordUserId}`;
}

export interface ReportFixedNotificationInput {
  reportId: string;
  statusEventId: string;
  recipientDiscordUserId: string;
  type: "report_fixed";
  idempotencyKey: string;
}

export function buildReportFixedNotificationInputs(
  audience: ReportFixNotificationAudience,
  statusEventId: string,
): ReportFixedNotificationInput[] {
  return audience.recipientDiscordUserIds.map((recipientDiscordUserId) => ({
    reportId: audience.canonicalReportId,
    statusEventId,
    recipientDiscordUserId,
    type: "report_fixed",
    idempotencyKey: buildReportFixedNotificationIdempotencyKey({
      statusEventId,
      recipientDiscordUserId,
    }),
  }));
}

export function createNotificationSendJobV1(notificationId: string): NotificationSendJobV1 {
  return NotificationSendJobV1Schema.parse({
    jobName: "notification.send.v1",
    version: 1,
    notificationId,
  });
}
