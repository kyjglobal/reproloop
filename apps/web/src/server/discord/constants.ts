export const DISCORD_BUG_COMMAND_NAME = "bug";

export const DISCORD_BUG_OPTION_IDS = {
  project: "project",
  build: "build",
} as const;

export const DISCORD_BUG_MODAL_ID_PREFIX = "reproloop:bug:v1";

export const DISCORD_BUG_MODAL_FIELD_IDS = {
  actualResult: "actual_result",
  expectedResult: "expected_result",
  reproductionSteps: "reproduction_steps",
  platform: "platform",
  frequency: "frequency",
} as const;

export const DISCORD_EPHEMERAL_FLAG = 64;
export const DISCORD_AUTOCOMPLETE_CHOICE_LIMIT = 25;
export const DISCORD_REQUEST_MAX_AGE_MS = 5 * 60 * 1000;

export const discordBugApplicationCommand = {
  name: DISCORD_BUG_COMMAND_NAME,
  description: "게임 버그를 제보합니다.",
  type: 1,
  options: [
    {
      type: 3,
      name: DISCORD_BUG_OPTION_IDS.project,
      description: "버그가 발생한 프로젝트",
      required: true,
      autocomplete: true,
    },
    {
      type: 3,
      name: DISCORD_BUG_OPTION_IDS.build,
      description: "버그가 발생한 활성 빌드",
      required: true,
      autocomplete: true,
    },
  ],
} as const;
