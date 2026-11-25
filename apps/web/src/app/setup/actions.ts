"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { AccountSchema, initializeLocalOwner } from "@/server/auth/local-accounts";

const SetupSchema = AccountSchema.extend({
  team: z.string().trim().min(1).max(80),
  setupToken: z.string().trim().regex(/^[\w-]{32,128}$/),
});

export async function setupOwner(form: FormData) {
  if (process.env.REPROLOOP_MODE !== "local") redirect("/");
  const parsed = SetupSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success || !await initializeLocalOwner(parsed.data)) redirect("/setup?error=1");
  redirect("/login");
}
