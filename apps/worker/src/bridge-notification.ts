import type { Database } from "@reproloop/db/client";
import { bugReports, builds, discordGuilds, notifications } from "@reproloop/db/schema";
import { bridgeUrl } from "@reproloop/shared";
import { and, desc, eq, isNotNull, isNull, lt, ne, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { z } from "zod";

const sender = alias(bugReports, "recipient_report");
const maxUncertainAgeMs = 90_000;

export async function processBridgeNotification(database: Database, brokerUrl: string, id: string) {
  const [notification] = await database.select({
    status: notifications.status,
    lastErrorCode: notifications.lastErrorCode,
    dispatchStartedAt: notifications.dispatchStartedAt,
    recipient: notifications.recipientDiscordUserId,
    reportNumber: bugReports.reportNumber,
    build: builds.version,
    token: discordGuilds.bridgeToken,
    receipt: sql<string | null>`(
      select ${sender.bridgeReceipt} from ${bugReports} as "recipient_report"
      where ${sender.projectId} = ${bugReports.projectId}
        and ${sender.discordGuildId} = ${bugReports.discordGuildId}
        and (${sender.id} = ${bugReports.id} or ${sender.canonicalReportId} = ${bugReports.id})
        and ${sender.reporterDiscordUserId} = ${notifications.recipientDiscordUserId}
        and ${isNotNull(sender.bridgeReceipt)} and ${isNull(sender.deletedAt)}
      order by ${desc(sender.createdAt)} limit 1
    )`,
  }).from(notifications).innerJoin(bugReports, eq(bugReports.id, notifications.reportId))
    .leftJoin(builds, eq(builds.id, bugReports.fixedBuildId))
    .leftJoin(discordGuilds, and(eq(discordGuilds.discordGuildId, bugReports.discordGuildId), isNull(discordGuilds.removedAt)))
    .where(eq(notifications.id, id)).limit(1);

  if (!notification || notification.status === "sent" ||
    ["PERMANENT", "NEEDS_REVIEW"].includes(notification.lastErrorCode ?? "")) return;

  const now = new Date();
  const [claim] = await database.update(notifications).set({
    status: "processing",
    attemptCount: sql`${notifications.attemptCount} + 1`,
    dispatchStartedAt: sql`coalesce(${notifications.dispatchStartedAt}, now())`,
    updatedAt: now,
  }).where(and(
    eq(notifications.id, id),
    ne(notifications.status, "sent"),
    or(ne(notifications.status, "processing"), lt(notifications.updatedAt, new Date(now.getTime() - 20_000))),
  )).returning({ startedAt: notifications.dispatchStartedAt });
  if (!claim) throw new Error("알림 발송이 이미 진행 중입니다.");

  async function fail(code: string, message: string, retainDispatch = false) {
    await database.update(notifications).set({
      status: "failed", lastErrorCode: code, lastErrorMessage: message, updatedAt: new Date(),
      dispatchStartedAt: retainDispatch ? claim.startedAt : null,
    }).where(eq(notifications.id, id));
    if (code === "RETRY") throw new Error(message);
  }

  const previouslyUncertain = notification.dispatchStartedAt !== null;
  if (previouslyUncertain && claim.startedAt && now.getTime() - claim.startedAt.getTime() >= maxUncertainAgeMs) {
    return fail("NEEDS_REVIEW", "이전 DM 발송 결과를 확인해 주세요.", true);
  }
  if (!notification.receipt || !notification.build) {
    return fail("PERMANENT", "접수 증명 또는 수정 빌드를 찾을 수 없습니다.", previouslyUncertain);
  }
  if (!notification.token) return fail("RETRY", "Discord 서버를 연결해 주세요.", previouslyUncertain);

  let response: Response;
  try {
    response = await fetch(bridgeUrl(brokerUrl, "notify"), {
      method: "POST",
      redirect: "error",
      headers: { authorization: `Bearer ${notification.token}`, "content-type": "application/json" },
      body: JSON.stringify({
        receipt: notification.receipt, recipient: notification.recipient,
        reportNumber: notification.reportNumber, build: notification.build, notificationId: id,
      }),
      signal: AbortSignal.timeout(11_000),
    });
  } catch {
    return fail("RETRY", "봇에서 DM 발송 결과를 확인하지 못했습니다.", true);
  }
  if (response.status === 422 || response.status === 400) {
    return fail(previouslyUncertain ? "NEEDS_REVIEW" : "PERMANENT",
      "Discord DM을 보낼 수 없습니다. 접수 정보와 수신자의 DM 설정을 확인해 주세요.", previouslyUncertain);
  }
  if (!response.ok) {
    const uncertain = previouslyUncertain || (response.status >= 500 && response.status !== 503);
    return fail("RETRY", "봇에서 DM 발송 결과를 확인하지 못했습니다.", uncertain);
  }
  const message = z.object({ messageId: z.string().regex(/^\d{1,20}$/) }).safeParse(await response.json());
  if (!message.success) return fail("RETRY", "봇에서 DM 발송 결과를 확인하지 못했습니다.", true);

  await database.update(notifications).set({
    status: "sent", discordMessageId: message.data.messageId, sentAt: new Date(),
    lastErrorCode: null, lastErrorMessage: null, updatedAt: new Date(),
  }).where(eq(notifications.id, id));
}
