import { z } from "zod";

export const ORGANIZATION_ROLES = ["owner", "admin", "member"] as const;

export const OrganizationRoleSchema = z.enum(ORGANIZATION_ROLES);

export type OrganizationRole = z.infer<typeof OrganizationRoleSchema>;
