import { z } from "zod";

import { CreateBugReportCommandSchema } from "./reports/commands.js";

const snowflake = z.string().regex(/^\d{1,20}$/);
const project = z.object({ discordGuildId: snowflake, projectId: z.uuid() });
const query = z.string().max(100);

export const BridgeOperationSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("projects"),
    input: z.object({ discordGuildId: snowflake, query }),
  }),
  z.object({
    type: z.literal("builds"),
    input: project.extend({ query }),
  }),
  z.object({
    type: z.literal("selection"),
    input: project.extend({ buildId: z.uuid() }),
  }),
  z.object({
    type: z.literal("create"),
    input: CreateBugReportCommandSchema,
    receipt: z.string().max(512),
  }),
]);
export type BridgeOperation = z.infer<typeof BridgeOperationSchema>;

export const BridgeTaskSchema = z.object({ id: z.uuid(), operation: BridgeOperationSchema });
export const BridgePairSchema = z.object({
  id: z.uuid(),
  guildId: snowflake,
  guildName: z.string().min(1).max(100),
  token: z.string().regex(/^[\w-]{43}$/),
});
export const BridgeReplySchema = z.object({
  id: z.uuid(),
  result: z.unknown().optional(),
  failed: z.boolean().optional(),
});
export const BridgeNotificationSchema = z.object({
  receipt: z.string().max(512),
  recipient: snowflake,
  reportNumber: z.number().int().positive(),
  build: z.string().trim().min(1).max(100),
  notificationId: z.uuid(),
});

export function bridgeUrl(base: string, action: string): URL {
  const url = new URL(base);
  const isLoopback = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if (
    (url.protocol !== "https:" && !(url.protocol === "http:" && isLoopback)) ||
    url.username || url.password || url.search || url.hash
  ) {
    throw new Error("The bot URL must use HTTPS.");
  }
  return new URL(`/api/bridge/${action}`, url);
}
