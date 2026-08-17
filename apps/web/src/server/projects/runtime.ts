import { getDatabase } from "../db/connection";
import { DrizzleProjectQueryRepository } from "./drizzle-project-query-repository";

let repository: DrizzleProjectQueryRepository | undefined;

export function getProjectQueryRepository(): DrizzleProjectQueryRepository {
  repository ??= new DrizzleProjectQueryRepository(getDatabase());
  return repository;
}
