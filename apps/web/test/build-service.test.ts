import type { BuildSummary } from "@reproloop/shared";
import { describe, expect, it, vi } from "vitest";

import type { AuthGuards } from "../src/server/auth/types";
import { listAccessibleProjectBuilds } from "../src/server/builds/service";
import type { BuildQueryRepository } from "../src/server/builds/types";

const projectId = "22222222-2222-4222-8222-222222222222";

const build: BuildSummary = {
  id: "44444444-4444-4444-8444-444444444444",
  projectId,
  version: "1.2.0",
  isActive: true,
  releasedAt: "2026-08-17T00:00:00.000Z",
};

function createGuards(): AuthGuards {
  return {
    requireUser: vi.fn(),
    requireProjectMember: vi.fn(async () => ({
      projectId,
      organizationId: "33333333-3333-4333-8333-333333333333",
      userId: "11111111-1111-4111-8111-111111111111",
      role: "admin" as const,
    })),
  } as unknown as AuthGuards;
}

describe("build query service", () => {
  it("checks project membership before listing builds", async () => {
    const guards = createGuards();
    const repository = {
      listProjectBuilds: vi.fn(async () => [build]),
    } as unknown as BuildQueryRepository;

    await expect(listAccessibleProjectBuilds(guards, repository, projectId)).resolves.toEqual([
      build,
    ]);
    expect(guards.requireProjectMember).toHaveBeenCalledWith(projectId);
    expect(repository.listProjectBuilds).toHaveBeenCalledWith(projectId);
  });
});
