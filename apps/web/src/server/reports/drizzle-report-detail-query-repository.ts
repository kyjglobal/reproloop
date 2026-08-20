import type { Database } from "@reproloop/db/client";
import {
  attachments,
  bugReports,
  builds,
  statusEvents,
  users,
} from "@reproloop/db/schema";
import type {
  ReportAttachmentMetadata,
  ReportDetail,
  ReportStatusEvent,
} from "@reproloop/shared";
import { and, asc, count, eq, isNull } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import type { ReportDetailQueryRepository } from "./types";

const canonicalReports = alias(bugReports, "canonical_reports");
const fixedBuilds = alias(builds, "fixed_builds");
const duplicateReports = alias(bugReports, "detail_duplicate_reports");

export class DrizzleReportDetailQueryRepository implements ReportDetailQueryRepository {
  constructor(private readonly database: Database) {}

  async findReportProjectId(reportId: string): Promise<string | null> {
    const [row] = await this.database
      .select({ projectId: bugReports.projectId })
      .from(bugReports)
      .where(and(eq(bugReports.id, reportId), isNull(bugReports.deletedAt)))
      .limit(1);

    return row?.projectId ?? null;
  }

  async findReportDetail(reportId: string): Promise<ReportDetail | null> {
    const [reportRows, attachmentRows, eventRows, duplicateRows] = await Promise.all([
      this.database
        .select({
          id: bugReports.id,
          projectId: bugReports.projectId,
          reportNumber: bugReports.reportNumber,
          title: bugReports.title,
          status: bugReports.status,
          severity: bugReports.severity,
          buildId: builds.id,
          buildVersion: builds.version,
          fixedBuildId: fixedBuilds.id,
          fixedBuildVersion: fixedBuilds.version,
          canonicalReportId: canonicalReports.id,
          canonicalReportNumber: canonicalReports.reportNumber,
          canonicalReportTitle: canonicalReports.title,
          canonicalReportStatus: canonicalReports.status,
          reporterDiscordUserId: bugReports.reporterDiscordUserId,
          reporterDisplayName: bugReports.reporterDisplayName,
          actualResult: bugReports.actualResult,
          expectedResult: bugReports.expectedResult,
          reproductionSteps: bugReports.reproductionSteps,
          platform: bugReports.platform,
          environment: bugReports.environment,
          location: bugReports.location,
          frequency: bugReports.frequency,
          resolvedAt: bugReports.resolvedAt,
          createdAt: bugReports.createdAt,
          updatedAt: bugReports.updatedAt,
          version: bugReports.version,
        })
        .from(bugReports)
        .innerJoin(builds, eq(builds.id, bugReports.buildId))
        .leftJoin(
          canonicalReports,
          and(
            eq(canonicalReports.id, bugReports.canonicalReportId),
            isNull(canonicalReports.deletedAt),
          ),
        )
        .leftJoin(fixedBuilds, eq(fixedBuilds.id, bugReports.fixedBuildId))
        .where(and(eq(bugReports.id, reportId), isNull(bugReports.deletedAt)))
        .limit(1),
      this.database
        .select({
          id: attachments.id,
          originalFilename: attachments.originalFilename,
          contentType: attachments.contentType,
          sizeBytes: attachments.sizeBytes,
          sanitizedAt: attachments.sanitizedAt,
          createdAt: attachments.createdAt,
        })
        .from(attachments)
        .where(and(eq(attachments.reportId, reportId), isNull(attachments.deletedAt)))
        .orderBy(asc(attachments.createdAt), asc(attachments.id)),
      this.database
        .select({
          id: statusEvents.id,
          eventType: statusEvents.eventType,
          fromStatus: statusEvents.fromStatus,
          toStatus: statusEvents.toStatus,
          actorId: users.id,
          actorDisplayName: users.displayName,
          note: statusEvents.note,
          createdAt: statusEvents.createdAt,
        })
        .from(statusEvents)
        .leftJoin(users, eq(users.id, statusEvents.actorUserId))
        .where(eq(statusEvents.reportId, reportId))
        .orderBy(asc(statusEvents.createdAt), asc(statusEvents.id)),
      this.database
        .select({ duplicateCount: count(duplicateReports.id) })
        .from(duplicateReports)
        .where(
          and(
            eq(duplicateReports.canonicalReportId, reportId),
            isNull(duplicateReports.deletedAt),
          ),
        ),
    ]);

    const row = reportRows[0];
    if (!row) {
      return null;
    }

    const mappedAttachments: ReportAttachmentMetadata[] = attachmentRows.map(
      (attachment) => ({
        id: attachment.id,
        originalFilename: attachment.originalFilename,
        contentType: attachment.contentType,
        sizeBytes: attachment.sizeBytes,
        sanitizedAt: attachment.sanitizedAt?.toISOString() ?? null,
        createdAt: attachment.createdAt.toISOString(),
      }),
    );
    const mappedEvents: ReportStatusEvent[] = eventRows.map((event) => ({
      id: event.id,
      eventType: event.eventType,
      fromStatus: event.fromStatus,
      toStatus: event.toStatus,
      actor:
        event.actorId && event.actorDisplayName
          ? { id: event.actorId, displayName: event.actorDisplayName }
          : null,
      note: event.note,
      createdAt: event.createdAt.toISOString(),
    }));

    return {
      id: row.id,
      projectId: row.projectId,
      reportNumber: row.reportNumber,
      title: row.title,
      status: row.status,
      severity: row.severity,
      build: { id: row.buildId, version: row.buildVersion },
      fixedBuild:
        row.fixedBuildId && row.fixedBuildVersion
          ? { id: row.fixedBuildId, version: row.fixedBuildVersion }
          : null,
      canonicalReport:
        row.canonicalReportId &&
        row.canonicalReportNumber &&
        row.canonicalReportTitle &&
        row.canonicalReportStatus
          ? {
              id: row.canonicalReportId,
              reportNumber: row.canonicalReportNumber,
              title: row.canonicalReportTitle,
              status: row.canonicalReportStatus,
            }
          : null,
      reporterDiscordUserId: row.reporterDiscordUserId,
      reporterDisplayName: row.reporterDisplayName,
      actualResult: row.actualResult,
      expectedResult: row.expectedResult,
      reproductionSteps: row.reproductionSteps,
      platform: row.platform,
      environment: row.environment,
      location: row.location,
      frequency: row.frequency,
      duplicateCount: duplicateRows[0]?.duplicateCount ?? 0,
      attachments: mappedAttachments,
      statusEvents: mappedEvents,
      resolvedAt: row.resolvedAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      version: row.version,
    };
  }
}
