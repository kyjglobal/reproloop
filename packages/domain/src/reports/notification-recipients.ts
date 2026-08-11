export function collectNotificationRecipientIds(
  reporterDiscordUserIds: readonly (string | null | undefined)[],
): string[] {
  return [
    ...new Set(
      reporterDiscordUserIds.filter(
        (value): value is string => typeof value === "string" && value.length > 0,
      ),
    ),
  ];
}
