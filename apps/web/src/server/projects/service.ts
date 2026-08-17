import type { ProjectSummary } from "@reproloop/shared";

import { ApiRequestError } from "../api/errors";
import type { AuthGuards } from "../auth/types";
import type { ProjectQueryRepository } from "./types";

export async function listAccessibleProjects(
  guards: AuthGuards,
  repository: ProjectQueryRepository,
): Promise<ProjectSummary[]> {
  const user = await guards.requireUser();
  return repository.listAccessibleProjects(user.id);
}

export async function getAccessibleProject(
  guards: AuthGuards,
  repository: ProjectQueryRepository,
  projectId: string,
): Promise<ProjectSummary> {
  const membership = await guards.requireProjectMember(projectId);
  const project = await repository.findAccessibleProject({
    projectId,
    userId: membership.userId,
  });

  if (!project) {
    throw new ApiRequestError("NOT_FOUND", "프로젝트를 찾을 수 없습니다.");
  }

  return project;
}
