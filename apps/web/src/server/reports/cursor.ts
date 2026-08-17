import { z } from "zod";

import { ApiRequestError } from "../api/errors";

const ReportCursorSchema = z.strictObject({
  createdAt: z.string().datetime({ offset: true }),
  id: z.string().uuid(),
});

export interface ReportCursor {
  createdAt: Date;
  id: string;
}

export function encodeReportCursor(cursor: ReportCursor): string {
  return Buffer.from(
    JSON.stringify({ createdAt: cursor.createdAt.toISOString(), id: cursor.id }),
  ).toString("base64url");
}

export function decodeReportCursor(cursor: string): ReportCursor {
  try {
    const parsed = ReportCursorSchema.parse(
      JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")),
    );

    return { createdAt: new Date(parsed.createdAt), id: parsed.id };
  } catch {
    throw new ApiRequestError("VALIDATION_ERROR", "목록 cursor가 올바르지 않습니다.", {
      cursor: ["유효한 목록 cursor를 입력해 주세요."],
    });
  }
}
