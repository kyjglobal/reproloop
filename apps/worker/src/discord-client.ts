const DISCORD_API_BASE_URL = "https://discord.com/api/v10";

export interface DiscordNotificationClient {
  sendDirectMessage(recipientDiscordUserId: string, content: string): Promise<void>;
}

async function parseDiscordError(response: Response): Promise<string> {
  const body = await response.text();
  return `Discord API ${response.status}: ${body.slice(0, 500)}`;
}

export class DiscordBotClient implements DiscordNotificationClient {
  constructor(private readonly botToken: string) {
    if (!botToken.trim()) {
      throw new Error("DISCORD_BOT_TOKEN is missing or empty.");
    }
  }

  private async request(path: string, init: RequestInit): Promise<Response> {
    const response = await fetch(`${DISCORD_API_BASE_URL}${path}`, {
      ...init,
      headers: {
        authorization: `Bot ${this.botToken}`,
        "content-type": "application/json",
        ...init.headers,
      },
    });

    if (!response.ok) {
      throw new Error(await parseDiscordError(response));
    }
    return response;
  }

  async sendDirectMessage(
    recipientDiscordUserId: string,
    content: string,
  ): Promise<void> {
    const channelResponse = await this.request("/users/@me/channels", {
      method: "POST",
      body: JSON.stringify({ recipient_id: recipientDiscordUserId }),
    });
    const channel = (await channelResponse.json()) as { id?: unknown };
    if (typeof channel.id !== "string") {
      throw new Error("Discord did not return a DM channel ID.");
    }

    await this.request(`/channels/${channel.id}/messages`, {
      method: "POST",
      body: JSON.stringify({ content }),
    });
  }
}
