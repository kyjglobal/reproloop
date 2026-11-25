import { BridgeNotificationSchema, BridgeReplySchema } from "@reproloop/shared";
import { z } from "zod";

import { BridgeError, getDiscordBroker } from "@/server/discord/broker";
import { sendBrokerNotification } from "@/server/discord/broker-discord";

export const runtime = "nodejs";

const PairRequest = z.object({
  code: z.string().regex(/^[\w-]{16}$/),
  expectedGuildId: z.string().regex(/^\d{1,20}$/).optional(),
});

async function readJson(request: Request) {
  if (!request.body) throw new BridgeError(400, "요청 형식을 확인해 주세요.");
  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let size = 0;
  let text = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > 16_384) {
      await reader.cancel();
      throw new BridgeError(413, "요청의 크기가 너무 큽니다.");
    }
    text += decoder.decode(value, { stream: true });
  }
  try {
    return JSON.parse(text + decoder.decode()) as unknown;
  } catch {
    throw new BridgeError(400, "요청 형식을 확인해 주세요.");
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ action: string }> }) {
  if (process.env.REPROLOOP_MODE !== "broker") return new Response(null, { status: 404 });
  const { action } = await params;
  if (!["pair", "poll", "reply", "disconnect", "notify"].includes(action)) {
    return new Response(null, { status: 404 });
  }
  try {
    const broker = getDiscordBroker();
    if (action === "pair") {
      const { code, expectedGuildId } = PairRequest.parse(await readJson(request));
      return Response.json(broker.pair(code, expectedGuildId), { headers: { "cache-control": "no-store" } });
    }

    const installation = broker.authenticate(request.headers.get("authorization"));
    if (action === "poll") {
      const task = await broker.poll(installation, request.signal);
      return task ? Response.json(task) : new Response(null, { status: 204 });
    }
    if (action === "reply") {
      const { id, result, failed } = BridgeReplySchema.parse(await readJson(request));
      broker.reply(installation, id, result, failed);
      return new Response(null, { status: 204 });
    }
    if (action === "disconnect") {
      broker.revoke(installation);
      return new Response(null, { status: 204 });
    }
    const notification = BridgeNotificationSchema.parse(await readJson(request));
    return Response.json(await sendBrokerNotification(broker, installation, notification));
  } catch (error) {
    if (error instanceof BridgeError) return Response.json({ error: error.message }, { status: error.status });
    if (error instanceof z.ZodError) return Response.json({ error: "요청 형식을 확인해 주세요." }, { status: 400 });
    console.error("ReproLoop bridge request failed", { action });
    return Response.json({ error: "봇에서 요청을 처리하지 못했습니다." }, { status: 500 });
  }
}
