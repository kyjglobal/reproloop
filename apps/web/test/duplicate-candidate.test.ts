import type { Database } from "@reproloop/db/client";
import type { DuplicateCandidateQuery } from "@reproloop/shared";
import { describe, expect, it, vi } from "vitest";

import type { AuthGuards } from "../src/server/auth/types";
import { DrizzleDuplicateCandidateQueryRepository } from "../src/server/reports/drizzle-duplicate-candidate-query-repository";
import { listAccessibleDuplicateCandidates } from "../src/server/reports/service";
import type { DuplicateCandidateQueryRepository } from "../src/server/reports/types";

const projectId = "11111111-1111-4111-8111-111111111111";
const targetReportId = "22222222-2222-4222-8222-222222222222";
const candidateId = "33333333-3333-4333-8333-333333333333";
const query: DuplicateCandidateQuery = { search: "inventory", limit: 10 };

describe("duplicate candidate query", () => {
  it("checks project membership before querying candidates", async () => {
    const guards = {
      requireProjectMember: vi.fn(async () => ({ projectId })),
    } as unknown as AuthGuards;
    const repository = {
      findCandidateTargetProjectId: vi.fn(async () => projectId),
      listDuplicateCandidates: vi.fn(async () => []),
    } as DuplicateCandidateQueryRepository;

    await listAccessibleDuplicateCandidates(
      guards,
      repository,
      projectId,
      targetReportId,
      query,
    );

    expect(guards.requireProjectMember).toHaveBeenCalledWith(projectId);
    expect(repository.listDuplicateCandidates).toHaveBeenCalledWith({
      projectId,
      targetReportId,
      query,
    });
  });

  it("hides a missing, deleted, or cross-project target before membership lookup", async () => {
    const guards = {
      requireProjectMember: vi.fn(),
    } as unknown as AuthGuards;
    const repository = {
      findCandidateTargetProjectId: vi.fn(async () => null),
      listDuplicateCandidates: vi.fn(),
    } as DuplicateCandidateQueryRepository;

    await expect(
      listAccessibleDuplicateCandidates(
        guards,
        repository,
        projectId,
        targetReportId,
        query,
      ),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(guards.requireProjectMember).not.toHaveBeenCalled();
    expect(repository.listDuplicateCandidates).not.toHaveBeenCalled();
  });

  it("maps candidate rows to the compact picker DTO", async () => {
    const createdAt = new Date("2026-08-20T01:00:00.000Z");
    const limit = vi.fn(async () => [
      {
        id: candidateId,
        reportNumber: 12,
        title: "Inventory crash",
        status: "reproduced" as const,
        buildId: "44444444-4444-4444-8444-444444444444",
        buildVersion: "1.2.3",
        createdAt,
      },
    ]);
    const orderBy = vi.fn(() => ({ limit }));
    const where = vi.fn(() => ({ orderBy }));
    const innerJoin = vi.fn(() => ({ where }));
    const from = vi.fn(() => ({ innerJoin }));
    const select = vi.fn(() => ({ from }));
    const repository = new DrizzleDuplicateCandidateQueryRepository({
      select,
    } as unknown as Database);

    await expect(
      repository.listDuplicateCandidates({ projectId, targetReportId, query }),
    ).resolves.toEqual([
      {
        id: candidateId,
        reportNumber: 12,
        title: "Inventory crash",
        status: "reproduced",
        build: { id: "44444444-4444-4444-8444-444444444444", version: "1.2.3" },
        createdAt: createdAt.toISOString(),
      },
    ]);
    expect(limit).toHaveBeenCalledWith(10);
  });
});
