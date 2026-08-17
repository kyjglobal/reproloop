import { handleDiscordInteractionRequest } from "@/server/discord/request-handler";
import {
  getDiscordBugRepository,
  getDiscordPublicKey,
} from "@/server/discord/runtime";

export const runtime = "nodejs";

export function POST(request: Request) {
  return handleDiscordInteractionRequest(request, {
    publicKey: getDiscordPublicKey(),
    repository: getDiscordBugRepository(),
  });
}
