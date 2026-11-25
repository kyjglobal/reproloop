import { builds, discordGuilds, gameProjects, organizationMembers, users } from "@reproloop/db/schema";
import { and, asc, eq, isNull } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";

import { AuthAccessError } from "@/server/auth/errors";
import { getAuthAccessRepository, getAuthGuards } from "@/server/auth/runtime";
import { getDatabase } from "@/server/db/connection";

export const settingsMessages = {
  permission: "권한이 없습니다.",
  setup: "봇 운영 주소가 설정되어 있는지 확인해 주세요.",
  code: "연결 코드를 확인하거나 Discord에서 새 코드를 받아 주세요.",
  network: "봇 서비스에 연결할 수 없습니다. 잠시 후 다시 시도해 주세요.",
  connected: "Discord 서버를 저장했습니다. 연결 상태가 갱신되기까지 잠시 걸릴 수 있습니다.",
  disconnected: "Discord 연결을 해제했습니다.",
  missingGuild: "Discord 서버를 먼저 연결해 주세요.",
  invalid: "입력 내용을 확인해 주세요.",
  duplicate: "이미 등록된 이름 또는 빌드입니다.",
  saved: "저장했습니다.",
};

export async function getLocalMembership() {
  if (process.env.REPROLOOP_MODE !== "local") notFound();
  try {
    const user = await getAuthGuards().requireUser();
    const [membership] = await getAuthAccessRepository().listOrganizationMemberships(user.id);
    if (!membership) notFound();
    return membership;
  } catch (error) {
    if (error instanceof AuthAccessError && error.code === "UNAUTHENTICATED") redirect("/login");
    throw error;
  }
}

export async function getLocalSettings(organizationId: string, showTeam: boolean) {
  const db = getDatabase();
  const [guilds, projects, versions, team] = await Promise.all([
    db.select({
      name: discordGuilds.name,
      lastSeenAt: discordGuilds.bridgeLastSeenAt,
      removedAt: discordGuilds.removedAt,
    }).from(discordGuilds).where(eq(discordGuilds.organizationId, organizationId)).limit(1),
    db.select({ id: gameProjects.id, name: gameProjects.name }).from(gameProjects)
      .where(and(eq(gameProjects.organizationId, organizationId), isNull(gameProjects.archivedAt)))
      .orderBy(asc(gameProjects.name)),
    db.select({ projectId: builds.projectId, version: builds.version }).from(builds)
      .innerJoin(gameProjects, eq(gameProjects.id, builds.projectId))
      .where(and(eq(gameProjects.organizationId, organizationId), eq(builds.isActive, true)))
      .orderBy(asc(builds.version)),
    showTeam ? db.select({ id: users.id, name: users.displayName, role: organizationMembers.role })
      .from(organizationMembers).innerJoin(users, eq(users.id, organizationMembers.userId))
      .where(eq(organizationMembers.organizationId, organizationId)).orderBy(asc(users.displayName)) : [],
  ]);
  const guild = guilds[0];
  return {
    guild,
    connected: !!guild?.lastSeenAt && !guild.removedAt && Date.now() - guild.lastSeenAt.getTime() < 45_000,
    projects,
    versions,
    team,
  };
}
