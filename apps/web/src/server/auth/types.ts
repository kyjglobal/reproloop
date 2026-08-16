import type { OrganizationRole } from "@reproloop/shared";
import type { Session } from "next-auth";

export interface DiscordIdentity {
  discordUserId: string;
  displayName: string;
  email: string | null;
  avatarUrl: string | null;
}

export interface AuthenticatedUser extends DiscordIdentity {
  id: string;
}

export interface OrganizationMembership {
  organizationId: string;
  userId: string;
  role: OrganizationRole;
}

export interface UserOrganizationMembership extends OrganizationMembership {
  organizationName: string;
}

export interface ProjectMembership extends OrganizationMembership {
  projectId: string;
}

export interface AuthAccessRepository {
  resolveUser(identity: DiscordIdentity): Promise<AuthenticatedUser>;
  findOrganizationMembership(input: {
    organizationId: string;
    userId: string;
  }): Promise<OrganizationMembership | null>;
  findProjectMembership(input: {
    projectId: string;
    userId: string;
  }): Promise<ProjectMembership | null>;
  listOrganizationMemberships(userId: string): Promise<UserOrganizationMembership[]>;
}

export type SessionGetter = () => Promise<Session | null>;

export interface AuthGuardDependencies {
  getSession: SessionGetter;
  accessRepository: AuthAccessRepository;
}

export interface AuthGuards {
  requireUser(): Promise<AuthenticatedUser>;
  requireOrganizationMember(organizationId: string): Promise<OrganizationMembership>;
  requireProjectMember(projectId: string): Promise<ProjectMembership>;
}
