import type { Database } from "@reproloop/db/client";
import { describe, expect, it, vi } from "vitest";

import { DrizzleProjectQueryRepository } from "../src/server/projects/drizzle-project-query-repository";

const project = {
  id: "11111111-1111-4111-8111-111111111111",
  organizationId: "22222222-2222-4222-8222-222222222222",
  organizationName: "Small Moon Studio",
  name: "Repro Quest",
  slug: "repro-quest",
  defaultLocale: "ko",
  role: "member" as const,
};

describe("DrizzleProjectQueryRepository", () => {
  it("lists active projects joined through organization membership", async () => {
    const orderBy = vi.fn(async () => [project]);
    const where = vi.fn(() => ({ orderBy }));
    const secondJoin = vi.fn(() => ({ where }));
    const firstJoin = vi.fn(() => ({ innerJoin: secondJoin }));
    const from = vi.fn(() => ({ innerJoin: firstJoin }));
    const select = vi.fn(() => ({ from }));
    const repository = new DrizzleProjectQueryRepository({ select } as unknown as Database);

    await expect(repository.listAccessibleProjects("user-id")).resolves.toEqual([project]);
    expect(secondJoin).toHaveBeenCalledOnce();
    expect(orderBy).toHaveBeenCalledOnce();
  });

  it("returns one accessible project for a member", async () => {
    const limit = vi.fn(async () => [project]);
    const where = vi.fn(() => ({ limit }));
    const secondJoin = vi.fn(() => ({ where }));
    const firstJoin = vi.fn(() => ({ innerJoin: secondJoin }));
    const from = vi.fn(() => ({ innerJoin: firstJoin }));
    const select = vi.fn(() => ({ from }));
    const repository = new DrizzleProjectQueryRepository({ select } as unknown as Database);

    await expect(
      repository.findAccessibleProject({ projectId: project.id, userId: "user-id" }),
    ).resolves.toEqual(project);
    expect(limit).toHaveBeenCalledWith(1);
  });
});
