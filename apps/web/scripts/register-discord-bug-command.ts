import { resolve } from "node:path";

import { config } from "dotenv";

import { discordBugApplicationCommand, discordConnectApplicationCommand } from "../src/server/discord/constants";

const DISCORD_API_BASE_URL = "https://discord.com/api/v10";

config({ path: resolve(process.cwd(), "../../.env"), quiet: true });

function requiredEnvironmentVariable(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is missing or empty.`);
  return value;
}

async function discordRequest(path: string, token: string, init?: RequestInit) {
  const response = await fetch(`${DISCORD_API_BASE_URL}${path}`, {
    ...init,
    headers: {
      authorization: `Bot ${token}`,
      "content-type": "application/json",
      ...init?.headers,
    },
  });

  if (!response.ok) {
    const responseText = await response.text();
    throw new Error(`Discord API request failed (${response.status}): ${responseText}`);
  }

  return response.json() as Promise<unknown>;
}

interface RegisteredCommand {
  id: string;
  name: string;
}

function parseRegisteredCommands(value: unknown): RegisteredCommand[] {
  if (!Array.isArray(value)) throw new Error("Discord returned an invalid command list.");

  return value.flatMap((candidate) => {
    if (
      typeof candidate === "object" &&
      candidate !== null &&
      "id" in candidate &&
      "name" in candidate &&
      typeof candidate.id === "string" &&
      typeof candidate.name === "string"
    ) {
      return [{ id: candidate.id, name: candidate.name }];
    }
    return [];
  });
}

async function main() {
  const applicationId = requiredEnvironmentVariable("DISCORD_APPLICATION_ID");
  const botToken = requiredEnvironmentVariable("DISCORD_BOT_TOKEN");
  const global = process.argv.includes("--global");
  const commandsPath = global ? `/applications/${applicationId}/commands`
    : `/applications/${applicationId}/guilds/${requiredEnvironmentVariable("DISCORD_TEST_GUILD_ID")}/commands`;

  const registeredCommands = parseRegisteredCommands(
    await discordRequest(commandsPath, botToken),
  );
  for (const command of [discordBugApplicationCommand, discordConnectApplicationCommand]) {
    const existing = registeredCommands.find((candidate) => candidate.name === command.name);
    const body = global ? { ...command, integration_types: [0], contexts: [0] } : command;
    await discordRequest(existing ? `${commandsPath}/${existing.id}` : commandsPath, botToken, {
      method: existing ? "PATCH" : "POST",
      body: JSON.stringify(body),
    });
    console.log(`Discord /${command.name} command ${existing ? "updated" : "created"}.`);
  }
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Discord command registration failed.");
  process.exitCode = 1;
});
