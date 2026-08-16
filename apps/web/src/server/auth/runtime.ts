import { getDatabase } from "@/server/db/connection";

import { DrizzleAuthAccessRepository } from "./drizzle-auth-access-repository";
import { createAuthGuards } from "./guards";
import { getCurrentSession } from "./session";
import type { AuthAccessRepository } from "./types";

let repository: DrizzleAuthAccessRepository | undefined;

function getRepository(): DrizzleAuthAccessRepository {
  repository ??= new DrizzleAuthAccessRepository(getDatabase());
  return repository;
}

const lazyAccessRepository: AuthAccessRepository = {
  resolveUser: (identity) => getRepository().resolveUser(identity),
  findOrganizationMembership: (input) => getRepository().findOrganizationMembership(input),
  findProjectMembership: (input) => getRepository().findProjectMembership(input),
  listOrganizationMemberships: (userId) => getRepository().listOrganizationMemberships(userId),
};

const authGuards = createAuthGuards({
  getSession: getCurrentSession,
  accessRepository: lazyAccessRepository,
});

export function getAuthAccessRepository(): AuthAccessRepository {
  return lazyAccessRepository;
}

export function getAuthGuards() {
  return authGuards;
}
