import type { Database } from "@reproloop/db/client";
import {
  gameProjects,
  organizationMembers,
  organizations,
  users,
} from "@reproloop/db/schema";
import { and, asc, eq, isNull } from "drizzle-orm";

import type {
  AuthAccessRepository,
  DiscordIdentity,
  OrganizationMembership,
  ProjectMembership,
  UserOrganizationMembership,
} from "./types";
import { AuthAccessError } from "./errors";

export class DrizzleAuthAccessRepository implements AuthAccessRepository {
  constructor(private readonly database: Database) {}

  async resolveUser(identity: DiscordIdentity) {
    if (identity.discordUserId.startsWith("local:")) {
      const [local] = await this.database.select().from(users)
        .where(eq(users.discordUserId, identity.discordUserId));
      if (!local?.passwordHash) throw new AuthAccessError("UNAUTHENTICATED", "로그인이 필요합니다.");
      return {
        id: local.id,
        discordUserId: local.discordUserId,
        displayName: local.displayName,
        email: local.email,
        avatarUrl: local.avatarUrl,
      };
    }
    const [user] = await this.database
      .insert(users)
      .values({
        discordUserId: identity.discordUserId,
        displayName: identity.displayName,
        email: identity.email,
        avatarUrl: identity.avatarUrl,
      })
      .onConflictDoUpdate({
        target: users.discordUserId,
        set: {
          displayName: identity.displayName,
          email: identity.email,
          avatarUrl: identity.avatarUrl,
          updatedAt: new Date(),
        },
      })
      .returning({
        id: users.id,
        discordUserId: users.discordUserId,
        displayName: users.displayName,
        email: users.email,
        avatarUrl: users.avatarUrl,
      });

    if (!user) {
      throw new Error("Failed to resolve the authenticated user.");
    }

    return user;
  }

  async findOrganizationMembership(input: {
    organizationId: string;
    userId: string;
  }): Promise<OrganizationMembership | null> {
    const [membership] = await this.database
      .select({
        organizationId: organizationMembers.organizationId,
        userId: organizationMembers.userId,
        role: organizationMembers.role,
      })
      .from(organizationMembers)
      .where(
        and(
          eq(organizationMembers.organizationId, input.organizationId),
          eq(organizationMembers.userId, input.userId),
        ),
      )
      .limit(1);

    return membership ?? null;
  }

  async findProjectMembership(input: {
    projectId: string;
    userId: string;
  }): Promise<ProjectMembership | null> {
    const [membership] = await this.database
      .select({
        projectId: gameProjects.id,
        organizationId: organizationMembers.organizationId,
        userId: organizationMembers.userId,
        role: organizationMembers.role,
      })
      .from(gameProjects)
      .innerJoin(
        organizationMembers,
        and(
          eq(organizationMembers.organizationId, gameProjects.organizationId),
          eq(organizationMembers.userId, input.userId),
        ),
      )
      .where(and(eq(gameProjects.id, input.projectId), isNull(gameProjects.archivedAt)))
      .limit(1);

    return membership ?? null;
  }

  async listOrganizationMemberships(userId: string): Promise<UserOrganizationMembership[]> {
    return this.database
      .select({
        organizationId: organizationMembers.organizationId,
        organizationName: organizations.name,
        userId: organizationMembers.userId,
        role: organizationMembers.role,
      })
      .from(organizationMembers)
      .innerJoin(organizations, eq(organizations.id, organizationMembers.organizationId))
      .where(eq(organizationMembers.userId, userId))
      .orderBy(asc(organizations.name));
  }
}
