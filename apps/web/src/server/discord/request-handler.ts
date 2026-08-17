import type { DiscordBugRepository, DiscordInteractionLogger } from "./types";
import {
  handleDiscordInteraction,
  handleDiscordModalSubmission,
} from "./interaction-handler";
import { parseModalSubmit } from "./interaction-parser";
import { editOriginalDiscordInteractionResponse } from "./followup";
import { deferredEphemeralMessage, ephemeralMessage } from "./responses";
import { verifyDiscordRequest } from "./verify-request";

const defaultLogger: DiscordInteractionLogger = {
  error(message, context) {
    console.error(message, context);
  },
};

function json(body: unknown, init?: ResponseInit) {
  return Response.json(body, init);
}

export async function handleDiscordInteractionRequest(
  request: Request,
  dependencies: {
    publicKey: string;
    repository: DiscordBugRepository;
    now?: Date;
    logger?: DiscordInteractionLogger;
    scheduleAfterResponse?: (task: () => Promise<void>) => void;
    editOriginalResponse?: typeof editOriginalDiscordInteractionResponse;
  },
): Promise<Response> {
  const requestId = request.headers.get("x-request-id")?.trim() || crypto.randomUUID();
  const rawBody = await request.text();
  const verification = await verifyDiscordRequest({
    rawBody,
    signature: request.headers.get("x-signature-ed25519"),
    timestamp: request.headers.get("x-signature-timestamp"),
    publicKey: dependencies.publicKey,
    now: dependencies.now,
  });

  if (!verification.ok) {
    return json(
      { error: "invalid request signature" },
      { status: 401, headers: { "x-request-id": requestId } },
    );
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return json(
      { error: "invalid interaction payload" },
      { status: 400, headers: { "x-request-id": requestId } },
    );
  }

  try {
    const modal = parseModalSubmit(payload);
    if (modal && dependencies.scheduleAfterResponse) {
      const logger = dependencies.logger ?? defaultLogger;
      const editOriginalResponse =
        dependencies.editOriginalResponse ?? editOriginalDiscordInteractionResponse;

      dependencies.scheduleAfterResponse(async () => {
        let content: string;

        try {
          content = await handleDiscordModalSubmission(modal, dependencies.repository);
        } catch (error) {
          logger.error("Discord interaction failed", { requestId, error });
          content = `제보 처리에 실패했습니다. 문의 코드: ${requestId}`;
        }

        try {
          await editOriginalResponse({
            applicationId: modal.application_id,
            interactionToken: modal.token,
            content,
          });
        } catch (error) {
          logger.error("Discord interaction follow-up failed", { requestId, error });
        }
      });

      return json(deferredEphemeralMessage(), {
        headers: { "x-request-id": requestId },
      });
    }

    const interactionResponse = await handleDiscordInteraction(
      payload,
      dependencies.repository,
    );

    if (!interactionResponse) {
      return json(
        { error: "unsupported interaction type" },
        { status: 400, headers: { "x-request-id": requestId } },
      );
    }

    return json(interactionResponse, { headers: { "x-request-id": requestId } });
  } catch (error) {
    (dependencies.logger ?? defaultLogger).error("Discord interaction failed", {
      requestId,
      error,
    });
    return json(ephemeralMessage(`제보 처리에 실패했습니다. 문의 코드: ${requestId}`), {
      headers: { "x-request-id": requestId },
    });
  }
}
