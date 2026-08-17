import type { ProjectSummary } from "@reproloop/shared";

export interface ProjectQueryRepository {
  listAccessibleProjects(userId: string): Promise<ProjectSummary[]>;
  findAccessibleProject(input: {
    projectId: string;
    userId: string;
  }): Promise<ProjectSummary | null>;
}
