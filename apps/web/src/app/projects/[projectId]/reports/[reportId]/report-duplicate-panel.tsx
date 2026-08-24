"use client";

import type {
  ApiDataResponse,
  ApiErrorResponse,
  ApiListResponse,
  DuplicateCandidate,
  ReportStatus,
  ReportTransitionResult,
} from "@reproloop/shared";
import { Link2, LoaderCircle, Search, Unlink } from "lucide-react";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";

const mergeableStatuses = new Set<ReportStatus>([
  "new",
  "needs_info",
  "investigating",
  "reproduced",
]);

interface ReportDuplicatePanelProps {
  projectId: string;
  reportId: string;
  status: ReportStatus;
  version: number;
  canManageDuplicates: boolean;
}

type Feedback = { kind: "success" | "error"; message: string };

export function ReportDuplicatePanel({
  projectId,
  reportId,
  status,
  version,
  canManageDuplicates,
}: ReportDuplicatePanelProps) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [candidates, setCandidates] = useState<DuplicateCandidate[]>([]);
  const [selectedCandidateId, setSelectedCandidateId] = useState("");
  const [searchPending, setSearchPending] = useState(false);
  const [transitionPending, setTransitionPending] = useState(false);
  const [searched, setSearched] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>();

  if (!canManageDuplicates || (!mergeableStatuses.has(status) && status !== "duplicate")) {
    return null;
  }

  async function readError(response: Response): Promise<string> {
    const body = (await response.json()) as ApiErrorResponse;
    if (body.error.code === "CONFLICT") {
      router.refresh();
      return `${body.error.message} 최신 제보를 다시 불러왔으니 상태를 확인해 주세요.`;
    }
    return body.error.message;
  }

  async function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (searchPending || transitionPending) return;

    const params = new URLSearchParams({ limit: "10" });
    const trimmedSearch = search.trim();
    if (trimmedSearch) params.set("search", trimmedSearch);

    setSearchPending(true);
    setFeedback(undefined);
    try {
      const response = await fetch(
        `/api/v1/projects/${projectId}/reports/${reportId}/duplicate-candidates?${params}`,
      );
      if (!response.ok) {
        throw new Error(await readError(response));
      }

      const body = (await response.json()) as ApiListResponse<DuplicateCandidate>;
      setCandidates(body.data);
      setSelectedCandidateId((current) =>
        body.data.some((candidate) => candidate.id === current) ? current : "",
      );
      setSearched(true);
    } catch (error) {
      setCandidates([]);
      setSelectedCandidateId("");
      setSearched(true);
      setFeedback({
        kind: "error",
        message: error instanceof Error ? error.message : "대표 제보를 검색하지 못했습니다.",
      });
    } finally {
      setSearchPending(false);
    }
  }

  async function submitTransition(
    action: "merge_duplicate" | "unmerge_duplicate",
    canonicalReportId?: string,
  ) {
    if (transitionPending || searchPending) return;

    const selectedCandidate = candidates.find(
      (candidate) => candidate.id === canonicalReportId,
    );
    const confirmed = window.confirm(
      action === "merge_duplicate"
        ? `이 제보를 BUG-${selectedCandidate?.reportNumber ?? "?"}의 중복으로 병합할까요?`
        : "중복 병합을 취소하고 병합 직전 상태로 복원할까요?",
    );
    if (!confirmed) return;

    setTransitionPending(true);
    setFeedback(undefined);
    try {
      const payload =
        action === "merge_duplicate"
          ? { action, canonicalReportId, expectedVersion: version }
          : { action, expectedVersion: version };
      const response = await fetch(`/api/v1/reports/${reportId}/transitions`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        throw new Error(await readError(response));
      }

      const body = (await response.json()) as ApiDataResponse<ReportTransitionResult>;
      setFeedback({
        kind: "success",
        message:
          body.data.action === "merge_duplicate"
            ? "중복 제보로 병합했습니다."
            : "중복 병합을 취소하고 이전 상태로 복원했습니다.",
      });
      router.refresh();
    } catch (error) {
      setFeedback({
        kind: "error",
        message: error instanceof Error ? error.message : "중복 처리를 완료하지 못했습니다.",
      });
    } finally {
      setTransitionPending(false);
    }
  }

  if (status === "duplicate") {
    return (
      <section className="mt-5 rounded-lg border border-amber-200 bg-amber-50 p-5 sm:p-6">
        <h2 className="text-base font-semibold text-amber-950">중복 병합 관리</h2>
        <p className="mt-2 text-sm leading-6 text-amber-900">
          병합을 취소하면 서버에 기록된 병합 직전 상태로 복원됩니다.
        </p>
        <button
          type="button"
          disabled={transitionPending}
          onClick={() => submitTransition("unmerge_duplicate")}
          className="mt-4 inline-flex h-10 items-center justify-center gap-2 rounded-md border border-amber-300 bg-white px-4 text-sm font-semibold text-amber-950 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {transitionPending ? (
            <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            <Unlink className="size-4" aria-hidden="true" />
          )}
          {transitionPending ? "취소 처리 중" : "중복 병합 취소"}
        </button>
        <p
          aria-live="polite"
          className={`mt-3 min-h-5 text-sm ${feedback?.kind === "error" ? "text-red-700" : "text-emerald-700"}`}
        >
          {feedback?.message}
        </p>
      </section>
    );
  }

  return (
    <section className="mt-5 rounded-lg border border-zinc-200 bg-white p-5 sm:p-6">
      <h2 className="text-base font-semibold">중복 제보 병합</h2>
      <p className="mt-2 text-sm leading-6 text-zinc-600">
        같은 프로젝트의 대표 제보를 검색한 뒤 병합할 대상을 선택하세요.
      </p>

      <form className="mt-4 flex flex-col gap-2 sm:flex-row" onSubmit={submitSearch}>
        <label className="sr-only" htmlFor="duplicate-candidate-search">
          대표 제보 제목 검색
        </label>
        <input
          id="duplicate-candidate-search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          maxLength={200}
          disabled={searchPending || transitionPending}
          placeholder="제목으로 검색하거나 비워서 전체 조회"
          className="h-10 min-w-0 flex-1 rounded-md border border-zinc-300 bg-white px-3 text-sm outline-none focus:border-zinc-600 focus:ring-2 focus:ring-zinc-200 disabled:bg-zinc-100"
        />
        <button
          type="submit"
          disabled={searchPending || transitionPending}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-zinc-300 bg-white px-4 text-sm font-medium hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {searchPending ? (
            <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            <Search className="size-4" aria-hidden="true" />
          )}
          {searchPending ? "검색 중" : "대표 제보 검색"}
        </button>
      </form>

      {searched ? (
        candidates.length > 0 ? (
          <fieldset className="mt-4">
            <legend className="text-sm font-medium text-zinc-700">검색 결과</legend>
            <div className="mt-2 space-y-2">
              {candidates.map((candidate) => (
                <label
                  key={candidate.id}
                  className={`flex cursor-pointer items-start gap-3 rounded-md border p-3 ${
                    selectedCandidateId === candidate.id
                      ? "border-zinc-700 bg-zinc-50"
                      : "border-zinc-200"
                  }`}
                >
                  <input
                    type="radio"
                    name="canonicalReportId"
                    value={candidate.id}
                    checked={selectedCandidateId === candidate.id}
                    onChange={() => setSelectedCandidateId(candidate.id)}
                    disabled={transitionPending}
                    className="mt-1"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block break-words text-sm font-semibold text-zinc-900">
                      BUG-{candidate.reportNumber} · {candidate.title}
                    </span>
                    <span className="mt-1 block text-xs text-zinc-500">
                      {candidate.status} · 빌드 {candidate.build.version} ·{" "}
                      {new Date(candidate.createdAt).toLocaleString("ko-KR")}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
        ) : (
          <p className="mt-4 rounded-md bg-zinc-100 px-3 py-4 text-sm text-zinc-600">
            조건에 맞는 대표 제보가 없습니다.
          </p>
        )
      ) : null}

      <button
        type="button"
        disabled={!selectedCandidateId || transitionPending || searchPending}
        onClick={() => submitTransition("merge_duplicate", selectedCandidateId)}
        className="mt-4 inline-flex h-10 items-center justify-center gap-2 rounded-md bg-zinc-950 px-4 text-sm font-medium text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {transitionPending ? (
          <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
        ) : (
          <Link2 className="size-4" aria-hidden="true" />
        )}
        {transitionPending ? "병합 중" : "선택한 제보에 병합"}
      </button>
      <p
        aria-live="polite"
        className={`mt-3 min-h-5 text-sm ${feedback?.kind === "error" ? "text-red-700" : "text-emerald-700"}`}
      >
        {feedback?.message}
      </p>
    </section>
  );
}
