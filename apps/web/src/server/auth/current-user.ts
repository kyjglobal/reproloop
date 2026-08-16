import type { OrganizationRole } from "@reproloop/shared";

import type { AuthAccessRepository, AuthGuards } from "./types";

export interface CurrentUserOrganization {
  id: string;
  name: string;
  role: OrganizationRole;
}

export interface CurrentUserProfile {
  id: string;
  discordUserId: string;
  displayName: string;
  organizations: CurrentUserOrganization[];
}

export async function getCurrentUserProfile(
  guards: AuthGuards,
  accessRepository: AuthAccessRepository,
): Promise<CurrentUserProfile> {
  const user = await guards.requireUser();
  const memberships = await accessRepository.listOrganizationMemberships(user.id);

  return {
    id: user.id,
    discordUserId: user.discordUserId,
    displayName: user.displayName,
    organizations: memberships.map((membership) => ({
      id: membership.organizationId,
      name: membership.organizationName,
      role: membership.role,
    })),
  };
}
