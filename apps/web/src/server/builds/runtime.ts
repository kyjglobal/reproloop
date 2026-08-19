import { getDatabase } from "../db/connection";
import { DrizzleBuildQueryRepository } from "./drizzle-build-query-repository";

let repository: DrizzleBuildQueryRepository | undefined;

export function getBuildQueryRepository(): DrizzleBuildQueryRepository {
  repository ??= new DrizzleBuildQueryRepository(getDatabase());
  return repository;
}
