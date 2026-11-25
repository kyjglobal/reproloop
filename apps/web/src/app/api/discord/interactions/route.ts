import { handleDiscordInteractionRequest } from "@/server/discord/request-handler";
import { after } from "next/server";
import { BridgeError, getDiscordBroker } from "@/server/discord/broker";
import { handleBrokerCommand } from "@/server/discord/broker-discord";
import {
  getDiscordBugRepository,
  getDiscordPublicKey,
} from "@/server/discord/runtime";

export const runtime = "nodejs";

export function POST(request: Request) {
  if (process.env.REPROLOOP_MODE === "local") return new Response(null, { status: 404 });
  if (process.env.REPROLOOP_MODE === "broker") {
    const broker = getDiscordBroker();
    return handleDiscordInteractionRequest(request, {
      publicKey: getDiscordPublicKey(),
      repository: broker.repository(),
      scheduleAfterResponse: after,
      specialInteraction: (payload) => handleBrokerCommand(broker, payload),
      friendlyError: (error) => error instanceof BridgeError ? error.message : undefined,
      logger: { error: (message, { requestId }) => console.error(message, { requestId }) },
    });
  }
  return handleDiscordInteractionRequest(request, {
    publicKey: getDiscordPublicKey(),
    repository: getDiscordBugRepository(),
    scheduleAfterResponse: after,
  });
}
