import type { ProjectSummary } from "@reproloop/shared";
import { describe, expect, it, vi } from "vitest";

import { ApiRequestError } from "../src/server/api/errors";
import type { AuthGuards } from "../src/server/auth/types";
import {
  getAccessibleProject,
  listAccessibleProjects,
} from "../src/server/projects/service";
import type { ProjectQueryRepository } from "../src/server/projects/types";

const userId = "11111111-1111-4111-8111-111111111111";
const projectId = "22222222-2222-4222-8222-222222222222";
const organizationId = "33333333-3333-4333-8333-333333333333";
const project: ProjectSummary = {
  id: projectId,
  organizationId,
  organizationName: "Small Moon Studio",
  name: "Repro Quest",
  slug: "repro-quest",
  defaultLocale: "ko",
  role: "admin",
};

function createGuards(): AuthGuards {
  return {
    requireUser: vi.fn(async () => ({
      id: userId,
      discordUserId: "123456789012345678",
      displayName: "Developer",
      email: null,
      avatarUrl: null,
    })),
    requireProjectMember: vi.fn(async () => ({
      projectId,
      organizationId,
      userId,
      role: "admin" as const,
    })),
  } as unknown as AuthGuards;
}

describe("project query service", () => {
  it("lists projects using the authenticated application user ID", async () => {
    const guards = createGuards();
    const repository = {
      listAccessibleProjects: vi.fn(async () => [project]),
    } as unknown as ProjectQueryRepository;

    await expect(listAccessibleProjects(guards, repository)).resolves.toEqual([project]);
    expect(repository.listAccessibleProjects).toHaveBeenCalledWith(userId);
  });

  it("checks project membership before returning a project", async () => {
    const guards = createGuards();
    const repository = {
      findAccessibleProject: vi.fn(async () => project),
    } as unknown as ProjectQueryRepository;

    await expect(getAccessibleProject(guards, repository, projectId)).resolves.toEqual(project);
    expect(guards.requireProjectMember).toHaveBeenCalledWith(projectId);
    expect(repository.findAccessibleProject).toHaveBeenCalledWith({ projectId, userId });
  });

  it("returns NOT_FOUND when a permitted project disappears during the request", async () => {
    const guards = createGuards();
    const repository = {
      findAccessibleProject: vi.fn(async () => null),
    } as unknown as ProjectQueryRepository;

    await expect(getAccessibleProject(guards, repository, projectId)).rejects.toMatchObject({
      code: "NOT_FOUND",
    } satisfies Partial<ApiRequestError>);
  });
});
