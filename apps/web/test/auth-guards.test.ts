import type { Session } from "next-auth";
import { describe, expect, it, vi } from "vitest";

import { AuthAccessInvariantError } from "../src/server/auth/errors";
import { createAuthGuards } from "../src/server/auth/guards";
import type { AuthAccessRepository } from "../src/server/auth/types";

const userId = "11111111-1111-4111-8111-111111111111";
const organizationId = "22222222-2222-4222-8222-222222222222";
const projectId = "33333333-3333-4333-8333-333333333333";
const discordUserId = "123456789012345678";

function createSession(): Session {
  return {
    expires: new Date(Date.now() + 60_000).toISOString(),
    user: {
      discordUserId,
      name: "Developer",
      email: "developer@example.com",
      image: null,
    },
  };
}

function createRepository(): AuthAccessRepository {
  return {
    resolveUser: vi.fn(async (identity) => ({ id: userId, ...identity })),
    findOrganizationMembership: vi.fn(async () => ({
      organizationId,
      userId,
      role: "admin" as const,
    })),
    findProjectMembership: vi.fn(async () => ({
      organizationId,
      projectId,
      userId,
      role: "member" as const,
    })),
  };
}

describe("auth guards", () => {
  it("rejects an unauthenticated request before accessing the repository", async () => {
    const repository = createRepository();
    const guards = createAuthGuards({
      getSession: async () => null,
      accessRepository: repository,
    });

    await expect(guards.requireUser()).rejects.toMatchObject({
      code: "UNAUTHENTICATED",
    });
    expect(repository.resolveUser).not.toHaveBeenCalled();
  });

  it("resolves the application user from the Discord session", async () => {
    const repository = createRepository();
    const guards = createAuthGuards({
      getSession: async () => createSession(),
      accessRepository: repository,
    });

    await expect(guards.requireUser()).resolves.toMatchObject({ id: userId, discordUserId });
    expect(repository.resolveUser).toHaveBeenCalledWith({
      discordUserId,
      displayName: "Developer",
      email: "developer@example.com",
      avatarUrl: null,
    });
  });

  it("returns a validated project membership", async () => {
    const guards = createAuthGuards({
      getSession: async () => createSession(),
      accessRepository: createRepository(),
    });

    await expect(guards.requireProjectMember(projectId)).resolves.toEqual({
      organizationId,
      projectId,
      userId,
      role: "member",
    });
  });

  it("rejects a user outside the project", async () => {
    const repository = createRepository();
    repository.findProjectMembership = vi.fn(async () => null);
    const guards = createAuthGuards({
      getSession: async () => createSession(),
      accessRepository: repository,
    });

    await expect(guards.requireProjectMember(projectId)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("rejects mismatched membership data from the repository", async () => {
    const repository = createRepository();
    repository.findProjectMembership = vi.fn(async () => ({
      organizationId,
      projectId: "44444444-4444-4444-8444-444444444444",
      userId,
      role: "member" as const,
    }));
    const guards = createAuthGuards({
      getSession: async () => createSession(),
      accessRepository: repository,
    });

    await expect(guards.requireProjectMember(projectId)).rejects.toBeInstanceOf(
      AuthAccessInvariantError,
    );
  });
});
