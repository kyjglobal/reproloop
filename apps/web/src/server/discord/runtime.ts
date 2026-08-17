import { getDatabase } from "../db/connection";
import { DrizzleDiscordBugRepository } from "./drizzle-discord-bug-repository";

export class DiscordConfigurationError extends Error {
  constructor(variableName: string) {
    super(`${variableName} is missing or empty.`);
    this.name = "DiscordConfigurationError";
  }
}

let repository: DrizzleDiscordBugRepository | undefined;

export function getDiscordPublicKey(): string {
  const publicKey = process.env.DISCORD_PUBLIC_KEY?.trim();
  if (!publicKey) throw new DiscordConfigurationError("DISCORD_PUBLIC_KEY");
  return publicKey;
}

export function getDiscordBugRepository(): DrizzleDiscordBugRepository {
  repository ??= new DrizzleDiscordBugRepository(getDatabase());
  return repository;
}
