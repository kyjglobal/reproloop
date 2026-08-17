import { z } from "zod";

import {
  DISCORD_BUG_MODAL_FIELD_IDS,
  DISCORD_BUG_MODAL_ID_PREFIX,
  DISCORD_BUG_OPTION_IDS,
} from "./constants";
import type { DiscordBugSelection } from "./types";

const SnowflakeSchema = z.string().trim().min(1);
const UuidSchema = z.string().uuid();

const CommandOptionSchema = z.object({
  name: z.string(),
  type: z.number().int(),
  value: z.union([z.string(), z.number(), z.boolean()]).optional(),
  focused: z.boolean().optional(),
});

const DiscordUserSchema = z.object({
  id: SnowflakeSchema,
  username: z.string().trim().min(1),
  global_name: z.string().trim().min(1).nullable().optional(),
});

const GuildInteractionSchema = z.object({
  id: SnowflakeSchema,
  type: z.number().int(),
  guild_id: SnowflakeSchema,
  channel_id: SnowflakeSchema,
  member: z.object({
    nick: z.string().trim().min(1).nullable().optional(),
    user: DiscordUserSchema,
  }),
});

const ApplicationCommandSchema = GuildInteractionSchema.extend({
  type: z.literal(2),
  data: z.object({
    name: z.string(),
    options: z.array(CommandOptionSchema).optional().default([]),
  }),
});

const AutocompleteInteractionSchema = GuildInteractionSchema.extend({
  type: z.literal(4),
  data: z.object({
    name: z.string(),
    options: z.array(CommandOptionSchema).optional().default([]),
  }),
});

const ModalComponentSchema = z.object({
  custom_id: z.string(),
  value: z.string(),
});

const ModalSubmitSchema = GuildInteractionSchema.extend({
  type: z.literal(5),
  application_id: SnowflakeSchema,
  token: z.string().trim().min(1),
  data: z.object({
    custom_id: z.string(),
    components: z.array(
      z.object({
        components: z.array(ModalComponentSchema),
      }),
    ),
  }),
});

export type DiscordApplicationCommand = z.infer<typeof ApplicationCommandSchema>;
export type DiscordAutocompleteInteraction = z.infer<typeof AutocompleteInteractionSchema>;
export type DiscordModalSubmit = z.infer<typeof ModalSubmitSchema>;

export function parseApplicationCommand(value: unknown): DiscordApplicationCommand | null {
  const result = ApplicationCommandSchema.safeParse(value);
  return result.success ? result.data : null;
}

export function parseAutocompleteInteraction(
  value: unknown,
): DiscordAutocompleteInteraction | null {
  const result = AutocompleteInteractionSchema.safeParse(value);
  return result.success ? result.data : null;
}

export function parseModalSubmit(value: unknown): DiscordModalSubmit | null {
  const result = ModalSubmitSchema.safeParse(value);
  return result.success ? result.data : null;
}

export function getStringOption(
  options: readonly z.infer<typeof CommandOptionSchema>[],
  name: string,
): string | null {
  const option = options.find((candidate) => candidate.name === name);
  return typeof option?.value === "string" ? option.value : null;
}

export function getUuidOption(
  options: readonly z.infer<typeof CommandOptionSchema>[],
  name: string,
): string | null {
  const result = UuidSchema.safeParse(getStringOption(options, name));
  return result.success ? result.data : null;
}

export function getFocusedOption(
  options: readonly z.infer<typeof CommandOptionSchema>[],
): { name: string; value: string } | null {
  const option = options.find((candidate) => candidate.focused === true);
  return option && typeof option.value === "string"
    ? { name: option.name, value: option.value }
    : null;
}

export function createBugModalCustomId(selection: DiscordBugSelection): string {
  return `${DISCORD_BUG_MODAL_ID_PREFIX}:${selection.projectId}:${selection.buildId}`;
}

export function parseBugModalCustomId(customId: string): DiscordBugSelection | null {
  const prefix = `${DISCORD_BUG_MODAL_ID_PREFIX}:`;
  if (!customId.startsWith(prefix)) return null;

  const parts = customId.slice(prefix.length).split(":");
  if (parts.length !== 2) return null;

  const result = z.tuple([UuidSchema, UuidSchema]).safeParse(parts);
  return result.success ? { projectId: result.data[0], buildId: result.data[1] } : null;
}

export function extractBugModalFields(
  interaction: DiscordModalSubmit,
): Record<keyof typeof DISCORD_BUG_MODAL_FIELD_IDS, string> | null {
  const values = new Map<string, string>();

  for (const row of interaction.data.components) {
    for (const component of row.components) {
      if (values.has(component.custom_id)) return null;
      values.set(component.custom_id, component.value);
    }
  }

  const expectedIds = Object.values(DISCORD_BUG_MODAL_FIELD_IDS);
  if (values.size !== expectedIds.length || expectedIds.some((id) => !values.has(id))) {
    return null;
  }

  return {
    actualResult: values.get(DISCORD_BUG_MODAL_FIELD_IDS.actualResult)!,
    expectedResult: values.get(DISCORD_BUG_MODAL_FIELD_IDS.expectedResult)!,
    reproductionSteps: values.get(DISCORD_BUG_MODAL_FIELD_IDS.reproductionSteps)!,
    platform: values.get(DISCORD_BUG_MODAL_FIELD_IDS.platform)!,
    frequency: values.get(DISCORD_BUG_MODAL_FIELD_IDS.frequency)!,
  };
}

export function readBugSelectionFromOptions(
  options: readonly z.infer<typeof CommandOptionSchema>[],
): DiscordBugSelection | null {
  const result = z
    .object({ projectId: UuidSchema, buildId: UuidSchema })
    .safeParse({
      projectId: getUuidOption(options, DISCORD_BUG_OPTION_IDS.project),
      buildId: getUuidOption(options, DISCORD_BUG_OPTION_IDS.build),
    });

  return result.success ? result.data : null;
}
