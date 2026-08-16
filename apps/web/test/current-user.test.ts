import { describe, expect, it, vi } from "vitest";

import { getCurrentUserProfile } from "../src/server/auth/current-user";
import type { AuthAccessRepository, AuthGuards } from "../src/server/auth/types";

const userId = "11111111-1111-4111-8111-111111111111";
const organizationId = "22222222-2222-4222-8222-222222222222";

describe("current user profile", () => {
  it("maps the authenticated user and organization memberships to the API shape", async () => {
    const guards = {
      requireUser: vi.fn(async () => ({
        id: userId,
        discordUserId: "123456789012345678",
        displayName: "Developer",
        email: "developer@example.com",
        avatarUrl: null,
      })),
    } as unknown as AuthGuards;
    const accessRepository = {
      listOrganizationMemberships: vi.fn(async () => [
        {
          organizationId,
          organizationName: "Small Moon Studio",
          userId,
          role: "owner" as const,
        },
      ]),
    } as unknown as AuthAccessRepository;

    await expect(getCurrentUserProfile(guards, accessRepository)).resolves.toEqual({
      id: userId,
      discordUserId: "123456789012345678",
      displayName: "Developer",
      organizations: [
        {
          id: organizationId,
          name: "Small Moon Studio",
          role: "owner",
        },
      ],
    });
    expect(accessRepository.listOrganizationMemberships).toHaveBeenCalledWith(userId);
  });

  it("returns an empty organization list for a user without memberships", async () => {
    const guards = {
      requireUser: vi.fn(async () => ({
        id: userId,
        discordUserId: "123456789012345678",
        displayName: "Developer",
        email: null,
        avatarUrl: null,
      })),
    } as unknown as AuthGuards;
    const accessRepository = {
      listOrganizationMemberships: vi.fn(async () => []),
    } as unknown as AuthAccessRepository;

    const result = await getCurrentUserProfile(guards, accessRepository);

    expect(result.organizations).toEqual([]);
  });
});
