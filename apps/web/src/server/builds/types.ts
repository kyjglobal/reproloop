import type { BuildSummary } from "@reproloop/shared";

export interface BuildQueryRepository {
  listProjectBuilds(projectId: string): Promise<BuildSummary[]>;
}
