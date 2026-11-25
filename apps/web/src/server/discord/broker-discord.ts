import { createHash } from "node:crypto";

import type { BridgeNotificationSchema } from "@reproloop/shared";
import { z } from "zod";

import { BridgeError, type DiscordBroker, type Installation } from "./broker";
import { ephemeralMessage } from "./responses";

const discordUrl = "https://discord.com/api/v10/";
const snowflake = z.string().regex(/^\d{1,20}$/);
const connectCommand = z.object({
  type: z.literal(2),
  guild_id: snowflake,
  guild: z.object({ name: z.string().min(1).max(100) }).optional(),
  member: z.object({ permissions: z.string().regex(/^\d{1,24}$/) }),
  data: z.object({
    name: z.literal("reproloop"),
    options: z.tuple([z.object({ type: z.literal(1), name: z.literal("connect") })]),
  }),
});
const responseId = z.object({ id: snowflake });

export async function handleBrokerCommand(broker: DiscordBroker, payload: unknown) {
  const parsed = connectCommand.safeParse(payload);
  if (!parsed.success) return undefined;
  const interaction = parsed.data;
  const permissions = BigInt(interaction.member.permissions);
  if ((permissions & BigInt(40)) === BigInt(0)) {
    return ephemeralMessage("Discord의 서버 관리 권한이 필요합니다.");
  }
  const guildId = interaction.guild_id;
  const fallback = `Discord 서버 ${guildId}`;
  let guildName = interaction.guild?.name ?? fallback;
  if (!interaction.guild?.name && process.env.DISCORD_BOT_TOKEN) {
    try {
      const response = await fetch(`${discordUrl}guilds/${guildId}`, {
        headers: { authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}` },
        signal: AbortSignal.timeout(900),
      });
      if (response.ok) {
        guildName = z.object({ name: z.string().min(1).max(100) }).parse(await response.json()).name;
      }
    } catch {
      guildName = fallback;
    }
  }
  const code = broker.issueCode(guildId, guildName);
  return ephemeralMessage(`ReproLoop 연결 코드: ${code}\n5분 안에 로컬 관리자 화면에 입력해 주세요.`);
}

type Notification = z.infer<typeof BridgeNotificationSchema>;
type RateWindow = { count: number; until: number };
const rateWindows = new Map<string, RateWindow>();

export async function sendBrokerNotification(
  broker: DiscordBroker,
  installation: Installation,
  notification: Notification,
) {
  if (!broker.verifiesReceipt(installation, notification.recipient, notification.receipt)) {
    throw new BridgeError(422, "해당 설치본에서 접수한 Discord 제보를 확인할 수 없습니다.");
  }

  const now = Date.now();
  const rate = rateWindows.get(installation.id);
  if (rate && rate.until > now) {
    if (rate.count >= 60) throw new BridgeError(429, "Discord 발송 한도에 도달했습니다.");
    rate.count++;
  } else {
    for (const [id, window] of rateWindows) {
      if (window.until <= now) rateWindows.delete(id);
    }
    rateWindows.set(installation.id, { count: 1, until: now + 60_000 });
  }

  const token = process.env.DISCORD_BOT_TOKEN?.trim();
  if (!token) throw new BridgeError(503, "제공 봇의 발송 설정을 확인해 주세요.");
  const request = (path: string, body: unknown) => fetch(new URL(path, discordUrl), {
    method: "POST",
    headers: { authorization: `Bot ${token}`, "content-type": "application/json" },
    body: JSON.stringify(body),
    redirect: "error",
    signal: AbortSignal.timeout(4500),
  });

  // Discord deduplicates recent sends from the same author that use the same nonce.
  const nonce = createHash("sha256")
    .update(`${installation.id}:${notification.notificationId}`)
    .digest("base64url").slice(0, 25);
  const deliveryError = (response: Response) => {
    if (response.status === 429) return new BridgeError(429, "Discord 발송 한도에 도달했습니다.");
    if (response.status >= 500) return new BridgeError(502, "Discord에서 발송 결과를 확인하지 못했습니다.");
    return new BridgeError(422, "Discord DM을 보낼 수 없습니다. 수신자 설정을 확인해 주세요.");
  };

  let channelId: string;
  try {
    const channel = await request("users/@me/channels", { recipient_id: notification.recipient });
    if (!channel.ok) throw deliveryError(channel);
    channelId = responseId.parse(await channel.json()).id;
  } catch (error) {
    if (error instanceof BridgeError && error.status < 500) throw error;
    throw new BridgeError(503, "Discord DM 채널에 연결하지 못했습니다.");
  }

  const build = notification.build.replace(/[\r\n\x00-\x1f]/g, " ")
    .replace(/[\\`*_~|<>@]/g, "\\$&").replace(/https?:\/\//gi, "");
  try {
    const response = await request(`channels/${channelId}/messages`, {
      content: `BUG-${notification.reportNumber} 수정 완료\n수정 빌드: ${build}`,
      allowed_mentions: { parse: [] },
      nonce,
      enforce_nonce: true,
    });
    if (!response.ok) throw deliveryError(response);
    return { messageId: responseId.parse(await response.json()).id };
  } catch (error) {
    if (error instanceof BridgeError) throw error;
    throw new BridgeError(502, "Discord에서 발송 결과를 확인하지 못했습니다.");
  }
}
