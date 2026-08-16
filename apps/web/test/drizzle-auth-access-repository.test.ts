import type { Database } from "@reproloop/db/client";
import { describe, expect, it, vi } from "vitest";

import { DrizzleAuthAccessRepository } from "../src/server/auth/drizzle-auth-access-repository";

const userId = "11111111-1111-4111-8111-111111111111";
const organizationId = "22222222-2222-4222-8222-222222222222";
const projectId = "33333333-3333-4333-8333-333333333333";

describe("DrizzleAuthAccessRepository", () => {
  it("upserts a Discord identity and returns the application user", async () => {
    const user = {
      id: userId,
      discordUserId: "123456789012345678",
      displayName: "Developer",
      email: "developer@example.com",
      avatarUrl: null,
    };
    const returning = vi.fn(async () => [user]);
    const onConflictDoUpdate = vi.fn(() => ({ returning }));
    const values = vi.fn(() => ({ onConflictDoUpdate }));
    const insert = vi.fn(() => ({ values }));
    const database = { insert } as unknown as Database;
    const repository = new DrizzleAuthAccessRepository(database);

    await expect(
      repository.resolveUser({
        discordUserId: user.discordUserId,
        displayName: user.displayName,
        email: user.email,
        avatarUrl: user.avatarUrl,
      }),
    ).resolves.toEqual(user);
    expect(values).toHaveBeenCalledWith({
      discordUserId: user.discordUserId,
      displayName: user.displayName,
      email: user.email,
      avatarUrl: user.avatarUrl,
    });
    expect(onConflictDoUpdate).toHaveBeenCalledOnce();
  });

  it("returns project access inherited from organization membership", async () => {
    const membership = {
      projectId,
      organizationId,
      userId,
      role: "member" as const,
    };
    const limit = vi.fn(async () => [membership]);
    const where = vi.fn(() => ({ limit }));
    const innerJoin = vi.fn(() => ({ where }));
    const from = vi.fn(() => ({ innerJoin }));
    const select = vi.fn(() => ({ from }));
    const database = { select } as unknown as Database;
    const repository = new DrizzleAuthAccessRepository(database);

    await expect(repository.findProjectMembership({ projectId, userId })).resolves.toEqual(
      membership,
    );
    expect(innerJoin).toHaveBeenCalledOnce();
    expect(limit).toHaveBeenCalledWith(1);
  });
});
