import type { ApiErrorCode } from "@reproloop/shared";

export class ApiRequestError extends Error {
  constructor(
    readonly code: ApiErrorCode,
    message: string,
    readonly fieldErrors?: Readonly<Record<string, readonly string[]>>,
  ) {
    super(message);
    this.name = "ApiRequestError";
  }
}
