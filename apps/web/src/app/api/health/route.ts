import { sql } from "drizzle-orm";

import { getDatabase } from "@/server/db/connection";
import { getDiscordBroker } from "@/server/discord/broker";
import { getDiscordPublicKey } from "@/server/discord/runtime";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    if (process.env.REPROLOOP_MODE === "local") await getDatabase().execute(sql`select 1`);
    if (process.env.REPROLOOP_MODE === "broker") {
      getDiscordBroker();
      getDiscordPublicKey();
      if (!process.env.DISCORD_BOT_TOKEN) throw new Error("The bot token is missing.");
    }
    return Response.json({ status: "ready" });
  } catch {
    return Response.json({ status: "unavailable" }, { status: 503 });
  }
}
