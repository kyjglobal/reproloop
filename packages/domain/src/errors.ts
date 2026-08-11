import type { ApiErrorCode } from "@reproloop/shared";

export type ReportDomainErrorCode = Extract<
  ApiErrorCode,
  "VALIDATION_ERROR" | "FORBIDDEN" | "NOT_FOUND" | "CONFLICT" | "INVALID_STATUS_TRANSITION"
>;

export class ReportDomainError extends Error {
  readonly code: ReportDomainErrorCode;
  readonly fieldErrors?: Readonly<Record<string, readonly string[]>>;

  constructor(
    code: ReportDomainErrorCode,
    message: string,
    fieldErrors?: Readonly<Record<string, readonly string[]>>,
  ) {
    super(message);
    this.name = "ReportDomainError";
    this.code = code;
    this.fieldErrors = fieldErrors;
  }
}
