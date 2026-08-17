import { z } from "zod";

import { OrganizationRoleSchema } from "../enums/organization.js";
import {
  createApiDataResponseSchema,
  createApiListResponseSchema,
} from "../api/response.js";

export const ProjectSummarySchema = z.strictObject({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  organizationName: z.string().trim().min(1),
  name: z.string().trim().min(1),
  slug: z.string().trim().min(1),
  defaultLocale: z.string().trim().min(1),
  role: OrganizationRoleSchema,
});

export const ProjectSummaryResponseSchema = createApiDataResponseSchema(ProjectSummarySchema);
export const ProjectListResponseSchema = createApiListResponseSchema(ProjectSummarySchema);

export type ProjectSummary = z.infer<typeof ProjectSummarySchema>;
