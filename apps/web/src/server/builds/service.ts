import type { BuildSummary } from "@reproloop/shared";

import type { AuthGuards } from "../auth/types";
import type { BuildQueryRepository } from "./types";

export async function listAccessibleProjectBuilds(
  guards: AuthGuards,
  repository: BuildQueryRepository,
  projectId: string,
): Promise<BuildSummary[]> {
  await guards.requireProjectMember(projectId);
  return repository.listProjectBuilds(projectId);
}
