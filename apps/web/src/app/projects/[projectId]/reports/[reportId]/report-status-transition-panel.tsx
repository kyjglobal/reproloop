"use client";

import type {
  ApiDataResponse,
  ApiErrorResponse,
  ReportStatus,
  ReportTransitionResult,
} from "@reproloop/shared";
import { LoaderCircle, Send } from "lucide-react";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

type StatusAction = "request_information" | "start_investigation" | "mark_reproduced";

const actionsByStatus: Record<ReportStatus, readonly StatusAction[]> = {
  new: ["request_information", "start_investigation", "mark_reproduced"],
  needs_info: ["start_investigation"],
  investigating: ["request_information", "mark_reproduced"],
  reproduced: [],
  fixed: [],
  duplicate: [],
};

const actionLabels: Record<StatusAction, string> = {
  request_information: "추가 정보 요청",
  start_investigation: "조사 시작",
  mark_reproduced: "재현 완료",
};

interface ReportStatusTransitionPanelProps {
  reportId: string;
  status: ReportStatus;
  version: number;
}

export function ReportStatusTransitionPanel({
  reportId,
  status,
  version,
}: ReportStatusTransitionPanelProps) {
  const router = useRouter();
  const availableActions = actionsByStatus[status];
  const [action, setAction] = useState<StatusAction | "">(availableActions[0] ?? "");
  const [note, setNote] = useState("");
  const [pending, setPending] = useState(false);
  const [feedback, setFeedback] = useState<
    { kind: "success" | "error"; message: string } | undefined
  >();

  if (availableActions.length === 0) {
    return null;
  }

  async function submitTransition(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!action || pending) return;

    const trimmedNote = note.trim();
    if (action === "request_information" && !trimmedNote) {
      setFeedback({ kind: "error", message: "요청할 내용을 입력해 주세요." });
      return;
    }

    const payload =
      action === "request_information"
        ? { action, message: trimmedNote, expectedVersion: version }
        : {
            action,
            ...(trimmedNote ? { note: trimmedNote } : {}),
            expectedVersion: version,
          };

    setPending(true);
    setFeedback(undefined);

    try {
      const response = await fetch(`/api/v1/reports/${reportId}/transitions`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = (await response.json()) as
        | ApiDataResponse<ReportTransitionResult>
        | ApiErrorResponse;

      if (!response.ok) {
        const error = "error" in body ? body.error : undefined;
        if (error?.code === "CONFLICT") {
          router.refresh();
        }
        throw new Error(error?.message ?? "상태를 변경하지 못했습니다.");
      }

      setNote("");
      setFeedback({
        kind: "success",
        message: `${actionLabels[action]} 처리가 완료되었습니다.`,
      });
      router.refresh();
    } catch (error) {
      setFeedback({
        kind: "error",
        message: error instanceof Error ? error.message : "상태를 변경하지 못했습니다.",
      });
    } finally {
      setPending(false);
    }
  }

  const noteRequired = action === "request_information";

  return (
    <section className="mt-5 rounded-lg border border-zinc-200 bg-white p-5 sm:p-6">
      <h2 className="text-base font-semibold">상태 변경</h2>
      <form className="mt-4 grid gap-4" onSubmit={submitTransition}>
        <div className="grid gap-2 sm:grid-cols-[minmax(0,240px)_minmax(0,1fr)] sm:items-end">
          <label className="grid gap-2 text-sm font-medium text-zinc-700">
            처리
            <select
              value={action}
              onChange={(event) => {
                setAction(event.target.value as StatusAction);
                setFeedback(undefined);
              }}
              disabled={pending}
              className="h-10 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-900 outline-none focus:border-zinc-600 focus:ring-2 focus:ring-zinc-200 disabled:bg-zinc-100"
            >
              {availableActions.map((availableAction) => (
                <option key={availableAction} value={availableAction}>
                  {actionLabels[availableAction]}
                </option>
              ))}
            </select>
          </label>

          <button
            type="submit"
            disabled={pending || !action}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-zinc-950 px-4 text-sm font-medium text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {pending ? (
              <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <Send className="size-4" aria-hidden="true" />
            )}
            {pending ? "처리 중" : "적용"}
          </button>
        </div>

        <label className="grid gap-2 text-sm font-medium text-zinc-700">
          {noteRequired ? "요청 내용" : "처리 메모 (선택)"}
          <textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            required={noteRequired}
            maxLength={2000}
            rows={3}
            disabled={pending}
            className="min-h-24 w-full resize-y rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm leading-6 text-zinc-900 outline-none placeholder:text-zinc-400 focus:border-zinc-600 focus:ring-2 focus:ring-zinc-200 disabled:bg-zinc-100"
          />
        </label>

        <p
          aria-live="polite"
          className={`min-h-5 text-sm ${
            feedback?.kind === "error" ? "text-red-700" : "text-emerald-700"
          }`}
        >
          {feedback?.message}
        </p>
      </form>
    </section>
  );
}
