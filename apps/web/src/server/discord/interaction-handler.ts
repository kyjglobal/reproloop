import { CreateBugReportCommandSchema, DiscordBugModalInputSchema } from "@reproloop/shared";

import {
  DISCORD_AUTOCOMPLETE_CHOICE_LIMIT,
  DISCORD_BUG_COMMAND_NAME,
  DISCORD_BUG_OPTION_IDS,
} from "./constants";
import {
  extractBugModalFields,
  getFocusedOption,
  getUuidOption,
  parseApplicationCommand,
  parseAutocompleteInteraction,
  parseBugModalCustomId,
  parseModalSubmit,
  readBugSelectionFromOptions,
} from "./interaction-parser";
import {
  autocompleteResponse,
  bugModalResponse,
  ephemeralMessage,
  pongResponse,
} from "./responses";
import type { DiscordBugRepository } from "./types";
import type { DiscordModalSubmit } from "./interaction-parser";

function deriveTitle(actualResult: string): string {
  return actualResult.replace(/\s+/g, " ").trim().slice(0, 200);
}

function reporterDisplayName(interaction: {
  member: {
    nick?: string | null;
    user: { username: string; global_name?: string | null };
  };
}) {
  return (
    interaction.member.nick ??
    interaction.member.user.global_name ??
    interaction.member.user.username
  );
}

export async function handleDiscordInteraction(
  payload: unknown,
  repository: DiscordBugRepository,
) {
  if (typeof payload === "object" && payload !== null && "type" in payload && payload.type === 1) {
    return pongResponse();
  }

  const autocomplete = parseAutocompleteInteraction(payload);
  if (autocomplete) {
    if (autocomplete.data.name !== DISCORD_BUG_COMMAND_NAME) {
      return autocompleteResponse([]);
    }

    const focused = getFocusedOption(autocomplete.data.options);
    if (!focused) return autocompleteResponse([]);

    if (focused.name === DISCORD_BUG_OPTION_IDS.project) {
      const choices = await repository.listProjectChoices({
        discordGuildId: autocomplete.guild_id,
        query: focused.value,
      });
      return autocompleteResponse(choices.slice(0, DISCORD_AUTOCOMPLETE_CHOICE_LIMIT));
    }

    if (focused.name === DISCORD_BUG_OPTION_IDS.build) {
      const projectId = getUuidOption(
        autocomplete.data.options,
        DISCORD_BUG_OPTION_IDS.project,
      );
      if (!projectId) return autocompleteResponse([]);

      const choices = await repository.listBuildChoices({
        discordGuildId: autocomplete.guild_id,
        projectId,
        query: focused.value,
      });
      return autocompleteResponse(choices.slice(0, DISCORD_AUTOCOMPLETE_CHOICE_LIMIT));
    }

    return autocompleteResponse([]);
  }

  const command = parseApplicationCommand(payload);
  if (command) {
    if (command.data.name !== DISCORD_BUG_COMMAND_NAME) {
      return ephemeralMessage("지원하지 않는 명령입니다.");
    }

    const selection = readBugSelectionFromOptions(command.data.options);
    if (
      !selection ||
      !(await repository.selectionExists({
        discordGuildId: command.guild_id,
        ...selection,
      }))
    ) {
      return ephemeralMessage("선택한 프로젝트 또는 빌드를 사용할 수 없습니다.");
    }

    return bugModalResponse(selection);
  }

  const modal = parseModalSubmit(payload);
  if (modal) {
    return ephemeralMessage(await handleDiscordModalSubmission(modal, repository));
  }

  return null;
}

export async function handleDiscordModalSubmission(
  modal: DiscordModalSubmit,
  repository: DiscordBugRepository,
): Promise<string> {
  const selection = parseBugModalCustomId(modal.data.custom_id);
  const rawFields = extractBugModalFields(modal);
  const modalInput = DiscordBugModalInputSchema.safeParse(rawFields);

  if (!selection || !modalInput.success) {
    return "제보 입력을 확인해 주세요. 빠진 항목이나 너무 긴 항목이 있습니다.";
  }

  const commandInput = CreateBugReportCommandSchema.safeParse({
    ...modalInput.data,
    ...selection,
    title: deriveTitle(modalInput.data.actualResult),
    reporterDiscordUserId: modal.member.user.id,
    reporterDisplayName: reporterDisplayName(modal),
    discordGuildId: modal.guild_id,
    sourceChannelId: modal.channel_id,
    discordInteractionId: modal.id,
  });

  if (!commandInput.success) {
    return "제보 입력을 확인해 주세요. 빠진 항목이나 너무 긴 항목이 있습니다.";
  }

  const created = await repository.createReport(commandInput.data);
  return `BUG-${created.reportNumber}이 접수되었습니다.`;
}
