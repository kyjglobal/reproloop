import type { Database } from "@reproloop/db/client";
import { describe, expect, it, vi } from "vitest";

import { DrizzleBuildQueryRepository } from "../src/server/builds/drizzle-build-query-repository";

const buildRow = {
  id: "44444444-4444-4444-8444-444444444444",
  projectId: "22222222-2222-4222-8222-222222222222",
  version: "1.2.0",
  isActive: true,
  releasedAt: new Date("2026-08-17T00:00:00.000Z"),
};

describe("DrizzleBuildQueryRepository", () => {
  it("lists project builds and serializes dates", async () => {
    const orderBy = vi.fn(async () => [buildRow]);
    const where = vi.fn(() => ({ orderBy }));
    const from = vi.fn(() => ({ where }));
    const select = vi.fn(() => ({ from }));
    const repository = new DrizzleBuildQueryRepository({ select } as unknown as Database);

    await expect(repository.listProjectBuilds(buildRow.projectId)).resolves.toEqual([
      {
        ...buildRow,
        releasedAt: "2026-08-17T00:00:00.000Z",
      },
    ]);
    expect(where).toHaveBeenCalledOnce();
    expect(orderBy).toHaveBeenCalledOnce();
  });
});
