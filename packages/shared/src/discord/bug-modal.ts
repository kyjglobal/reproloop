import { z } from "zod";

export const DiscordBugModalInputSchema = z.strictObject({
  actualResult: z.string().trim().min(1).max(2000),
  expectedResult: z.string().trim().min(1).max(2000),
  reproductionSteps: z.string().trim().min(1).max(4000),
  platform: z.string().trim().min(1).max(200),
  frequency: z.string().trim().min(1).max(200),
});

export type DiscordBugModalInput = z.infer<typeof DiscordBugModalInputSchema>;
