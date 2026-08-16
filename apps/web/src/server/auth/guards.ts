import type { Session } from "next-auth";

import { AuthAccessError, AuthAccessInvariantError } from "./errors";
import type {
  AuthGuardDependencies,
  AuthGuards,
  DiscordIdentity,
  OrganizationMembership,
  ProjectMembership,
} from "./types";

function getDiscordIdentity(session: Session | null): DiscordIdentity {
  const sessionUser = session?.user;
  const discordUserId = sessionUser?.discordUserId?.trim();

  if (!discordUserId || !sessionUser) {
    throw new AuthAccessError("UNAUTHENTICATED", "로그인이 필요합니다.");
  }

  return {
    discordUserId,
    displayName: sessionUser.name?.trim() || discordUserId,
    email: sessionUser.email?.trim() || null,
    avatarUrl: sessionUser.image?.trim() || null,
  };
}

function validateOrganizationMembership(
  membership: OrganizationMembership,
  expected: { organizationId: string; userId: string },
): OrganizationMembership {
  if (
    membership.organizationId !== expected.organizationId ||
    membership.userId !== expected.userId
  ) {
    throw new AuthAccessInvariantError("The organization membership repository returned invalid data.");
  }

  return membership;
}

function validateProjectMembership(
  membership: ProjectMembership,
  expected: { projectId: string; userId: string },
): ProjectMembership {
  if (
    membership.projectId !== expected.projectId ||
    membership.userId !== expected.userId
  ) {
    throw new AuthAccessInvariantError("The project membership repository returned invalid data.");
  }

  return membership;
}

export function createAuthGuards(dependencies: AuthGuardDependencies): AuthGuards {
  async function requireUser() {
    const identity = getDiscordIdentity(await dependencies.getSession());
    const user = await dependencies.accessRepository.resolveUser(identity);

    if (user.discordUserId !== identity.discordUserId) {
      throw new AuthAccessInvariantError("The user repository returned a mismatched Discord identity.");
    }

    return user;
  }

  async function requireOrganizationMember(organizationId: string) {
    const user = await requireUser();
    const membership = await dependencies.accessRepository.findOrganizationMembership({
      organizationId,
      userId: user.id,
    });

    if (!membership) {
      throw new AuthAccessError("FORBIDDEN", "해당 조직에 접근할 권한이 없습니다.");
    }

    return validateOrganizationMembership(membership, { organizationId, userId: user.id });
  }

  async function requireProjectMember(projectId: string) {
    const user = await requireUser();
    const membership = await dependencies.accessRepository.findProjectMembership({
      projectId,
      userId: user.id,
    });

    if (!membership) {
      throw new AuthAccessError("FORBIDDEN", "해당 프로젝트에 접근할 권한이 없습니다.");
    }

    return validateProjectMembership(membership, { projectId, userId: user.id });
  }

  return {
    requireUser,
    requireOrganizationMember,
    requireProjectMember,
  };
}
