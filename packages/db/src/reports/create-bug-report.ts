import { and, eq, isNull, sql } from "drizzle-orm";

import { ReportDomainError } from "@reproloop/domain";
import type { CreateBugReportCommand } from "@reproloop/shared";

import type { Database } from "../client.js";
import {
  bugReports,
  builds,
  discordGuilds,
  gameProjects,
  statusEvents,
} from "../schema/index.js";

export interface CreateBugReportResult {
  id: string;
  reportNumber: number;
  created: boolean;
}

function isUniqueViolation(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }

  const candidate = error as { code?: unknown; cause?: unknown };
  return candidate.code === "23505" || isUniqueViolation(candidate.cause);
}

async function findByInteractionId(
  database: Database,
  discordInteractionId: string,
): Promise<CreateBugReportResult | null> {
  const [existing] = await database
    .select({ id: bugReports.id, reportNumber: bugReports.reportNumber })
    .from(bugReports)
    .where(eq(bugReports.discordInteractionId, discordInteractionId))
    .limit(1);

  return existing ? { ...existing, created: false } : null;
}

export async function createBugReport(
  database: Database,
  command: CreateBugReportCommand,
  bridgeReceipt?: string,
): Promise<CreateBugReportResult> {
  const existing = await findByInteractionId(database, command.discordInteractionId);
  if (existing) {
    return existing;
  }

  try {
    return await database.transaction(async (transaction) => {
      const [project] = await transaction
        .select({ id: gameProjects.id })
        .from(gameProjects)
        .innerJoin(discordGuilds, eq(gameProjects.discordGuildId, discordGuilds.id))
        .where(
          and(
            eq(gameProjects.id, command.projectId),
            eq(discordGuilds.discordGuildId, command.discordGuildId),
            isNull(gameProjects.archivedAt),
            isNull(discordGuilds.removedAt),
          ),
        )
        .limit(1);

      if (!project) {
        throw new ReportDomainError("NOT_FOUND", "프로젝트를 찾을 수 없습니다.");
      }

      const [build] = await transaction
        .select({ id: builds.id })
        .from(builds)
        .where(
          and(
            eq(builds.id, command.buildId),
            eq(builds.projectId, command.projectId),
            eq(builds.isActive, true),
          ),
        )
        .limit(1);

      if (!build) {
        throw new ReportDomainError("NOT_FOUND", "빌드를 찾을 수 없습니다.");
      }

      await transaction.execute(
        sql`select pg_advisory_xact_lock(hashtext(${command.projectId}))`,
      );

      const [numberRow] = await transaction
        .select({
          nextReportNumber: sql<number>`coalesce(max(${bugReports.reportNumber}), 0) + 1`.mapWith(
            Number,
          ),
        })
        .from(bugReports)
        .where(eq(bugReports.projectId, command.projectId));

      const reportNumber = numberRow?.nextReportNumber ?? 1;
      const [created] = await transaction
        .insert(bugReports)
        .values({
          projectId: command.projectId,
          reportNumber,
          buildId: command.buildId,
          title: command.title,
          severity: command.severity,
          actualResult: command.actualResult,
          expectedResult: command.expectedResult,
          reproductionSteps: command.reproductionSteps,
          platform: command.platform,
          environment: command.environment,
          location: command.location,
          frequency: command.frequency,
          reporterDiscordUserId: command.reporterDiscordUserId,
          reporterDisplayName: command.reporterDisplayName,
          discordGuildId: command.discordGuildId,
          sourceChannelId: command.sourceChannelId,
          discordInteractionId: command.discordInteractionId,
          bridgeReceipt,
        })
        .returning({ id: bugReports.id, reportNumber: bugReports.reportNumber });

      if (!created) {
        throw new Error("Failed to create bug report");
      }

      await transaction.insert(statusEvents).values({
        reportId: created.id,
        eventType: "report_created",
        fromStatus: null,
        toStatus: "new",
        metadata: { discordInteractionId: command.discordInteractionId },
      });

      return { ...created, created: true };
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      const racedExisting = await findByInteractionId(database, command.discordInteractionId);
      if (racedExisting) {
        return racedExisting;
      }
    }

    throw error;
  }
}
