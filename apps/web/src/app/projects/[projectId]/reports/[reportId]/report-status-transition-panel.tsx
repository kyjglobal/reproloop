"use client";

import type {
  ApiDataResponse,
  ApiErrorResponse,
  BuildSummary,
  ReportStatus,
  ReportTransitionResult,
} from "@reproloop/shared";
import { LoaderCircle, Send } from "lucide-react";
import { useRouter } from "next/navigation";
import { FormEvent, useState, useTransition } from "react";

type StatusAction =
  | "request_information"
  | "start_investigation"
  | "mark_reproduced"
  | "mark_fixed";

const actionsByStatus: Record<ReportStatus, readonly StatusAction[]> = {
  new: ["request_information", "start_investigation", "mark_reproduced"],
  needs_info: ["start_investigation"],
  investigating: ["request_information", "mark_reproduced"],
  reproduced: ["mark_fixed"],
  fixed: [],
  duplicate: [],
};

const actionLabels: Record<StatusAction, string> = {
  request_information: "추가 정보 요청",
  start_investigation: "조사 시작",
  mark_reproduced: "재현 완료",
  mark_fixed: "수정 완료",
};

interface ReportStatusTransitionPanelProps {
  reportId: string;
  status: ReportStatus;
  version: number;
  builds: BuildSummary[];
  canMarkFixed: boolean;
}

export function ReportStatusTransitionPanel({
  reportId,
  status,
  version,
  builds,
  canMarkFixed,
}: ReportStatusTransitionPanelProps) {
  const router = useRouter();
  const availableActions = actionsByStatus[status].filter(
    (availableAction) => availableAction !== "mark_fixed" || canMarkFixed,
  );
  const [action, setAction] = useState<StatusAction | "">(availableActions[0] ?? "");
  const [fixedBuildId, setFixedBuildId] = useState(
    builds.find((build) => build.isActive)?.id ?? builds[0]?.id ?? "",
  );
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [refreshing, refresh] = useTransition();
  const pending = saving || refreshing;
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
    if (action === "mark_fixed" && !fixedBuildId) {
      setFeedback({ kind: "error", message: "수정된 빌드를 선택해 주세요." });
      return;
    }

    const payload =
      action === "request_information"
        ? { action, message: trimmedNote, expectedVersion: version }
        : action === "mark_fixed"
          ? {
              action,
              fixedBuildId,
              ...(trimmedNote ? { note: trimmedNote } : {}),
              expectedVersion: version,
            }
        : {
            action,
            ...(trimmedNote ? { note: trimmedNote } : {}),
            expectedVersion: version,
          };

    setSaving(true);
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
          refresh(() => router.refresh());
        }
        throw new Error(error?.message ?? "상태를 변경하지 못했습니다.");
      }

      setNote("");
      setFeedback({
        kind: "success",
        message: `${actionLabels[action]} 처리가 완료되었습니다.`,
      });
      refresh(() => router.refresh());
    } catch (error) {
      setFeedback({
        kind: "error",
        message: error instanceof Error ? error.message : "상태를 변경하지 못했습니다.",
      });
    } finally {
      setSaving(false);
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
            disabled={pending || !action || (action === "mark_fixed" && !fixedBuildId)}
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

        {action === "mark_fixed" ? (
          <label className="grid gap-2 text-sm font-medium text-zinc-700">
            수정 빌드
            <select
              aria-label="수정 빌드"
              value={fixedBuildId}
              onChange={(event) => {
                setFixedBuildId(event.target.value);
                setFeedback(undefined);
              }}
              required
              disabled={pending || builds.length === 0}
              className="h-10 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-900 outline-none focus:border-zinc-600 focus:ring-2 focus:ring-zinc-200 disabled:bg-zinc-100"
            >
              {builds.length === 0 ? (
                <option value="">등록된 빌드가 없습니다</option>
              ) : (
                builds.map((build) => (
                  <option key={build.id} value={build.id}>
                    {build.version}{build.isActive ? " (활성)" : ""}
                  </option>
                ))
              )}
            </select>
          </label>
        ) : null}

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
