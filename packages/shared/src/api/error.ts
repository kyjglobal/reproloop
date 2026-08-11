import { z } from "zod";

import { ApiErrorCodeSchema } from "../enums/api-error.js";

export const ApiErrorDetailsSchema = z.strictObject({
  code: ApiErrorCodeSchema,
  message: z.string().trim().min(1),
  requestId: z.string().trim().min(1),
  fieldErrors: z
    .record(z.string().min(1), z.array(z.string().trim().min(1)).min(1))
    .optional(),
});

export const ApiErrorSchema = z.strictObject({
  error: ApiErrorDetailsSchema,
});

export type ApiErrorDetails = z.infer<typeof ApiErrorDetailsSchema>;
export type ApiErrorResponse = z.infer<typeof ApiErrorSchema>;
