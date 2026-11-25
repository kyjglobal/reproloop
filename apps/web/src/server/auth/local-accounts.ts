import { randomBytes, randomUUID, scrypt as deriveKey, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

import { organizationMembers, organizations, users } from "@reproloop/db/schema";
import { eq, isNotNull, sql } from "drizzle-orm";
import { z } from "zod";

import { getDatabase } from "../db/connection";

const scrypt = promisify(deriveKey);
const attempts = new Map<string, { count: number; renewAt: number }>();
export const AccountSchema = z.object({
  username: z.string().trim().toLowerCase().regex(/^[a-z0-9._-]{3,40}$/),
  displayName: z.string().trim().min(1).max(80),
  password: z.string().min(12).max(128),
});

async function encodePassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const digest = await scrypt(password, salt, 64) as Buffer;
  return `${salt}:${digest.toString("hex")}`;
}

function assertLocalMode() {
  if (process.env.REPROLOOP_MODE !== "local") throw new Error("Local account mode is disabled.");
}

export async function localSetupNeeded() {
  assertLocalMode();
  const [user] = await getDatabase().select({ id: users.id }).from(users)
    .where(isNotNull(users.localUsername)).limit(1);
  return !user;
}

export async function initializeLocalOwner(input: z.infer<typeof AccountSchema> & {
  team: string;
  setupToken: string;
}) {
  assertLocalMode();
  const token = process.env.REPROLOOP_SETUP_TOKEN;
  if (!token || token.length < 32 || token.length !== input.setupToken.length ||
    !timingSafeEqual(Buffer.from(token), Buffer.from(input.setupToken, "ascii"))) {
    return false;
  }
  const passwordHash = await encodePassword(input.password);
  return getDatabase().transaction(async (transaction) => {
    await transaction.execute(sql`select pg_advisory_xact_lock(hashtext('reproloop:local-setup'))`);
    const [existing] = await transaction.select({ id: users.id }).from(users)
      .where(isNotNull(users.localUsername)).limit(1);
    if (existing) return false;
    const [owner] = await transaction.insert(users).values({
      discordUserId: `local:${randomUUID()}`,
      localUsername: input.username,
      displayName: input.displayName,
      passwordHash,
    }).returning({ id: users.id });
    const [organization] = await transaction.insert(organizations).values({
      name: input.team,
      slug: "local",
      createdByUserId: owner.id,
    }).returning({ id: organizations.id });
    await transaction.insert(organizationMembers).values({
      organizationId: organization.id,
      userId: owner.id,
      role: "owner",
    });
    return true;
  });
}

export async function createLocalMember(
  organizationId: string,
  input: z.infer<typeof AccountSchema> & { role: "admin" | "member" },
) {
  assertLocalMode();
  const passwordHash = await encodePassword(input.password);
  return getDatabase().transaction(async (transaction) => {
    const [user] = await transaction.insert(users).values({
      discordUserId: `local:${randomUUID()}`,
      localUsername: input.username,
      displayName: input.displayName,
      passwordHash,
    }).onConflictDoNothing({ target: users.localUsername }).returning({ id: users.id });
    if (!user) return false;
    await transaction.insert(organizationMembers).values({
      organizationId,
      userId: user.id,
      role: input.role,
    });
    return true;
  });
}

const LoginSchema = AccountSchema.omit({ displayName: true });

export async function authenticateLocalAccount(input: unknown) {
  assertLocalMode();
  const credentials = LoginSchema.safeParse(input);
  if (!credentials.success) return null;
  const { username, password } = credentials.data;
  const now = Date.now();
  for (const [key, attempt] of attempts) {
    if (attempt.renewAt <= now) attempts.delete(key);
  }
  const key = username;
  const attempt = attempts.get(key);
  if ((attempt?.count ?? 0) >= 10 || (!attempt && attempts.size >= 128)) return null;
  attempts.set(key, { count: (attempt?.count ?? 0) + 1, renewAt: attempt?.renewAt ?? now + 60_000 });
  const [user] = await getDatabase().select().from(users).where(eq(users.localUsername, username));
  const [salt, expected] = (user?.passwordHash ?? `${"0".repeat(32)}:${"0".repeat(128)}`).split(":");
  const digest = await scrypt(password, salt, 64) as Buffer;
  if (!user?.passwordHash || !timingSafeEqual(Buffer.from(expected, "hex"), digest)) return null;
  attempts.delete(key);
  return { id: user.discordUserId, name: user.displayName };
}
