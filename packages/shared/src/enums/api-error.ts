import { z } from "zod";

export const API_ERROR_CODES = [
  "VALIDATION_ERROR",
  "UNAUTHENTICATED",
  "FORBIDDEN",
  "NOT_FOUND",
  "CONFLICT",
  "INVALID_STATUS_TRANSITION",
  "FILE_TOO_LARGE",
  "UNSUPPORTED_MEDIA_TYPE",
  "RATE_LIMITED",
  "INTERNAL_ERROR",
] as const;

export const ApiErrorCodeSchema = z.enum(API_ERROR_CODES);

export type ApiErrorCode = z.infer<typeof ApiErrorCodeSchema>;
