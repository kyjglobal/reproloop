type Fetch = typeof fetch;

export async function editOriginalDiscordInteractionResponse(
  input: {
    applicationId: string;
    interactionToken: string;
    content: string;
  },
  fetcher: Fetch = fetch,
): Promise<void> {
  const applicationId = encodeURIComponent(input.applicationId);
  const interactionToken = encodeURIComponent(input.interactionToken);
  const response = await fetcher(
    `https://discord.com/api/v10/webhooks/${applicationId}/${interactionToken}/messages/@original`,
    {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ content: input.content }),
    },
  );

  if (!response.ok) {
    throw new Error(`Discord interaction follow-up failed with HTTP ${response.status}.`);
  }
}
