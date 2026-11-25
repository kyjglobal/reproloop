import {
  InteractionResponseType,
  MessageComponentTypes,
  TextStyleTypes,
} from "discord-interactions";

import {
  DISCORD_BUG_MODAL_FIELD_IDS,
  DISCORD_EPHEMERAL_FLAG,
} from "./constants";
import { createBugModalCustomId } from "./interaction-parser";
import type { DiscordBugSelection, DiscordChoice } from "./types";

function textInput(input: {
  customId: string;
  label: string;
  style: TextStyleTypes;
  minLength: number;
  maxLength: number;
  placeholder?: string;
}) {
  return {
    type: 18, // Discord Label
    label: input.label,
    component: {
      type: MessageComponentTypes.INPUT_TEXT,
      custom_id: input.customId,
      style: input.style,
      min_length: input.minLength,
      max_length: input.maxLength,
      required: true,
      ...(input.placeholder ? { placeholder: input.placeholder } : {}),
    },
  };
}

export function pongResponse() {
  return { type: InteractionResponseType.PONG };
}

export function autocompleteResponse(choices: readonly DiscordChoice[]) {
  return {
    type: InteractionResponseType.APPLICATION_COMMAND_AUTOCOMPLETE_RESULT,
    data: { choices },
  };
}

export function deferredEphemeralMessage() {
  return {
    type: InteractionResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE,
    data: { flags: DISCORD_EPHEMERAL_FLAG },
  };
}

export function bugModalResponse(selection: DiscordBugSelection) {
  return {
    type: InteractionResponseType.MODAL,
    data: {
      custom_id: createBugModalCustomId(selection),
      title: "버그 제보",
      components: [
        textInput({
          customId: DISCORD_BUG_MODAL_FIELD_IDS.actualResult,
          label: "실제 현상",
          style: TextStyleTypes.PARAGRAPH,
          minLength: 1,
          maxLength: 2000,
          placeholder: "실제로 어떤 문제가 발생했나요?",
        }),
        textInput({
          customId: DISCORD_BUG_MODAL_FIELD_IDS.expectedResult,
          label: "기대 결과",
          style: TextStyleTypes.PARAGRAPH,
          minLength: 1,
          maxLength: 2000,
          placeholder: "정상이라면 어떻게 동작해야 하나요?",
        }),
        textInput({
          customId: DISCORD_BUG_MODAL_FIELD_IDS.reproductionSteps,
          label: "재현 방법",
          style: TextStyleTypes.PARAGRAPH,
          minLength: 1,
          maxLength: 4000,
          placeholder: "문제를 다시 발생시키는 순서를 적어주세요.",
        }),
        textInput({
          customId: DISCORD_BUG_MODAL_FIELD_IDS.platform,
          label: "플랫폼",
          style: TextStyleTypes.SHORT,
          minLength: 1,
          maxLength: 200,
          placeholder: "예: Windows 11, Steam Deck",
        }),
        textInput({
          customId: DISCORD_BUG_MODAL_FIELD_IDS.frequency,
          label: "발생 빈도",
          style: TextStyleTypes.SHORT,
          minLength: 1,
          maxLength: 200,
          placeholder: "예: 5회 중 3회",
        }),
      ],
    },
  };
}

export function ephemeralMessage(content: string) {
  return {
    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    data: { content, flags: DISCORD_EPHEMERAL_FLAG },
  };
}
