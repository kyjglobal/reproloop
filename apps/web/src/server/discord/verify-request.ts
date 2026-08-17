import { verifyKey } from "discord-interactions";

import { DISCORD_REQUEST_MAX_AGE_MS } from "./constants";

export type DiscordRequestVerificationResult =
  | { ok: true }
  | {
      ok: false;
      reason: "missing_headers" | "invalid_timestamp" | "expired_timestamp" | "invalid_signature";
    };

export async function verifyDiscordRequest(input: {
  rawBody: string;
  signature: string | null;
  timestamp: string | null;
  publicKey: string;
  now?: Date;
  maxAgeMs?: number;
}): Promise<DiscordRequestVerificationResult> {
  if (!input.signature || !input.timestamp) {
    return { ok: false, reason: "missing_headers" };
  }

  if (!/^\d+$/.test(input.timestamp)) {
    return { ok: false, reason: "invalid_timestamp" };
  }

  const timestampMs = Number(input.timestamp) * 1000;
  if (!Number.isSafeInteger(timestampMs)) {
    return { ok: false, reason: "invalid_timestamp" };
  }

  const nowMs = (input.now ?? new Date()).getTime();
  if (Math.abs(nowMs - timestampMs) > (input.maxAgeMs ?? DISCORD_REQUEST_MAX_AGE_MS)) {
    return { ok: false, reason: "expired_timestamp" };
  }

  try {
    const valid = await verifyKey(
      input.rawBody,
      input.signature,
      input.timestamp,
      input.publicKey,
    );

    return valid ? { ok: true } : { ok: false, reason: "invalid_signature" };
  } catch {
    return { ok: false, reason: "invalid_signature" };
  }
}
