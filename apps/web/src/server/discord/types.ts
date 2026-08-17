import type { CreateBugReportCommand } from "@reproloop/shared";

export interface DiscordChoice {
  name: string;
  value: string;
}

export interface DiscordBugSelection {
  projectId: string;
  buildId: string;
}

export interface DiscordBugRepository {
  listProjectChoices(input: {
    discordGuildId: string;
    query: string;
  }): Promise<readonly DiscordChoice[]>;
  listBuildChoices(input: {
    discordGuildId: string;
    projectId: string;
    query: string;
  }): Promise<readonly DiscordChoice[]>;
  selectionExists(input: {
    discordGuildId: string;
    projectId: string;
    buildId: string;
  }): Promise<boolean>;
  createReport(command: CreateBugReportCommand): Promise<{
    id: string;
    reportNumber: number;
    created: boolean;
  }>;
}

export interface DiscordInteractionLogger {
  error(message: string, context: { requestId: string; error: unknown }): void;
}
