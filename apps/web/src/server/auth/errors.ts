import type { ApiErrorCode } from "@reproloop/shared";

export type AuthAccessErrorCode = Extract<ApiErrorCode, "UNAUTHENTICATED" | "FORBIDDEN">;

export class AuthAccessError extends Error {
  readonly code: AuthAccessErrorCode;

  constructor(code: AuthAccessErrorCode, message: string) {
    super(message);
    this.name = "AuthAccessError";
    this.code = code;
  }
}

export class AuthAccessInvariantError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthAccessInvariantError";
  }
}
