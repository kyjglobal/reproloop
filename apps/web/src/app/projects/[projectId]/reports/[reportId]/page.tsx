import type {
  BuildSummary,
  ReportDetail,
  ReportSeverity,
  ReportStatus,
  ReportStatusEvent,
  StatusEventType,
} from "@reproloop/shared";
import { notifications } from "@reproloop/db/schema";
import { eq } from "drizzle-orm";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  CircleDot,
  FileText,
  Link2,
  Paperclip,
  UserRound,
} from "lucide-react";
import Link from "next/link";

import { ApiRequestError } from "@/server/api/errors";
import { ProjectReportIdParamsSchema } from "@/server/api/params";
import { AuthAccessError } from "@/server/auth/errors";
import { getAuthGuards } from "@/server/auth/runtime";
import { getBuildQueryRepository } from "@/server/builds/runtime";
import { listAccessibleProjectBuilds } from "@/server/builds/service";
import { getDatabase } from "@/server/db/connection";
import { getReportDetailQueryRepository } from "@/server/reports/runtime";
import {
  buildReportDetailHref,
  resolveReportsReturnHref,
} from "@/server/reports/navigation";
import { getAccessibleReportDetail } from "@/server/reports/service";

import { ReportStatusTransitionPanel } from "./report-status-transition-panel";
import { ReportDuplicatePanel } from "./report-duplicate-panel";

export const dynamic = "force-dynamic";

interface ReportDetailPageProps {
  params: Promise<{ projectId: string; reportId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

type Delivery = { id: string; status: typeof notifications.$inferSelect.status; explanation: string | null };

const statusLabels: Record<ReportStatus, string> = {
  new: "신규",
  needs_info: "정보 요청",
  investigating: "조사 중",
  reproduced: "재현됨",
  fixed: "수정됨",
  duplicate: "중복",
};

const severityLabels: Record<ReportSeverity, string> = {
  low: "낮음",
  medium: "보통",
  high: "높음",
  critical: "긴급",
};

const eventLabels: Record<StatusEventType, string> = {
  report_created: "제보가 접수되었습니다",
  information_requested: "추가 정보를 요청했습니다",
  investigation_started: "조사를 시작했습니다",
  report_reproduced: "버그를 재현했습니다",
  duplicate_merged: "중복 제보로 병합했습니다",
  duplicate_unmerged: "중복 병합을 취소했습니다",
  report_fixed: "수정 완료했습니다",
};

const dateFormatter = new Intl.DateTimeFormat("ko-KR", {
  dateStyle: "medium",
  timeStyle: "short",
});

function formatDate(value: string) {
  return dateFormatter.format(new Date(value));
}

function formatBytes(value: number) {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function TextField({ label, value }: { label: string; value: string | null }) {
  return (
    <section className="border-b border-zinc-200 pb-6 last:border-b-0 last:pb-0">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
        {label}
      </h2>
      <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-7 text-zinc-800">
        {value || "입력되지 않음"}
      </p>
    </section>
  );
}

function StatusBadge({ status }: { status: ReportStatus }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-zinc-300 bg-white px-3 py-1 text-xs font-semibold text-zinc-700">
      <CircleDot className="size-3.5" aria-hidden="true" />
      {statusLabels[status]}
    </span>
  );
}

function Timeline({ events }: { events: ReportStatusEvent[] }) {
  if (events.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-zinc-300 px-4 py-8 text-center text-sm text-zinc-500">
        아직 기록된 처리 이력이 없습니다.
      </div>
    );
  }

  return (
    <ol className="space-y-0">
      {events.map((event, index) => (
        <li key={event.id} className="relative grid grid-cols-[24px_minmax(0,1fr)] gap-3 pb-6 last:pb-0">
          {index < events.length - 1 ? (
            <span className="absolute left-[11px] top-5 h-full w-px bg-zinc-200" />
          ) : null}
          <span className="relative z-10 mt-1 flex size-6 items-center justify-center rounded-full border border-zinc-300 bg-white">
            <CheckCircle2 className="size-3.5 text-zinc-600" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-medium text-zinc-900">{eventLabels[event.eventType]}</p>
            <p className="mt-1 break-words text-xs leading-5 text-zinc-500">
              {formatDate(event.createdAt)} · {event.actor?.displayName ?? "시스템"}
            </p>
            {event.note ? (
              <p className="mt-2 whitespace-pre-wrap break-words rounded-md bg-zinc-100 px-3 py-2 text-sm leading-6 text-zinc-700">
                {event.note}
              </p>
            ) : null}
          </div>
        </li>
      ))}
    </ol>
  );
}

function ErrorState({
  error,
  projectId,
  reportId,
  reportsHref,
}: {
  error: unknown;
  projectId: string;
  reportId: string;
  reportsHref: string;
}) {
  const unauthenticated =
    error instanceof AuthAccessError && error.code === "UNAUTHENTICATED";
  const forbidden = error instanceof AuthAccessError && error.code === "FORBIDDEN";
  const notFound = error instanceof ApiRequestError && error.code === "NOT_FOUND";
  const title = unauthenticated
    ? "로그인이 필요합니다"
    : forbidden
      ? "프로젝트 권한이 없습니다"
      : notFound
        ? "제보를 찾을 수 없습니다"
        : "제보 상세를 불러오지 못했습니다";
  const description = unauthenticated
    ? "Discord로 로그인한 뒤 다시 열어 주세요."
    : forbidden
      ? "이 프로젝트의 조직 멤버만 제보를 볼 수 있습니다."
      : notFound
        ? "삭제되었거나 다른 프로젝트에 속한 제보인지 확인해 주세요."
        : "환경변수와 DB 연결 상태를 확인한 뒤 다시 시도해 주세요.";

  return (
    <main className="min-h-screen bg-zinc-50 px-4 py-10 text-zinc-950 sm:px-6 lg:px-8">
      <section className="mx-auto flex min-h-[70vh] max-w-xl flex-col items-center justify-center text-center">
        <div className="mb-6 flex size-12 items-center justify-center rounded-lg border border-red-200 bg-red-50 text-red-700">
          <AlertTriangle className="size-5" aria-hidden="true" />
        </div>
        <h1 className="text-2xl font-semibold">{title}</h1>
        <p className="mt-3 text-sm leading-6 text-zinc-600">{description}</p>
        <Link
          href={
            unauthenticated
              ? `/api/auth/signin?callbackUrl=${encodeURIComponent(
                  buildReportDetailHref(projectId, reportId, reportsHref),
                )}`
              : reportsHref
          }
          className="mt-6 inline-flex h-10 items-center rounded-md bg-zinc-950 px-4 text-sm font-medium text-white hover:bg-zinc-800"
        >
          {unauthenticated ? "Discord 로그인" : "제보 목록으로"}
        </Link>
      </section>
    </main>
  );
}

function ReportDetailView({
  detail,
  reportsHref,
  canManageDuplicates,
  builds,
  deliveries,
}: {
  detail: ReportDetail;
  reportsHref: string;
  canManageDuplicates: boolean;
  builds: BuildSummary[];
  deliveries: Delivery[];
}) {
  return (
    <main className="min-h-screen bg-zinc-50 text-zinc-950">
      <section className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <Link
          href={reportsHref}
          className="inline-flex items-center gap-2 text-sm font-medium text-zinc-600 hover:text-zinc-950"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          제보 목록
        </Link>

        <header className="mt-5 rounded-lg border border-zinc-200 bg-white p-5 sm:p-6">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-zinc-500">BUG-{detail.reportNumber}</span>
            <StatusBadge status={detail.status} />
            <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-700">
              심각도 {severityLabels[detail.severity]}
            </span>
          </div>
          <h1 className="mt-4 break-words text-2xl font-semibold leading-tight sm:text-3xl">
            {detail.title}
          </h1>
          <p className="mt-3 text-sm text-zinc-500">
            {formatDate(detail.createdAt)} 접수 · 버전 {detail.version}
          </p>
        </header>

        {detail.canonicalReport ? (
          <div className="mt-5 flex flex-col gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase text-amber-800">대표 제보</p>
              <p className="mt-1 truncate text-sm font-medium text-amber-950">
                BUG-{detail.canonicalReport.reportNumber} · {detail.canonicalReport.title}
              </p>
            </div>
            <Link
              href={buildReportDetailHref(
                detail.projectId,
                detail.canonicalReport.id,
                reportsHref,
              )}
              className="inline-flex shrink-0 items-center gap-2 text-sm font-semibold text-amber-900 hover:underline"
            >
              <Link2 className="size-4" aria-hidden="true" />
              대표 제보 열기
            </Link>
          </div>
        ) : null}

        <ReportStatusTransitionPanel
          key={`${detail.status}-${detail.version}`}
          reportId={detail.id}
          status={detail.status}
          version={detail.version}
          builds={builds}
          canMarkFixed={canManageDuplicates}
        />

        <ReportDuplicatePanel
          key={`duplicate-${detail.status}-${detail.version}`}
          projectId={detail.projectId}
          reportId={detail.id}
          status={detail.status}
          version={detail.version}
          canManageDuplicates={canManageDuplicates}
        />

        <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">
          <div className="min-w-0 rounded-lg border border-zinc-200 bg-white p-5 sm:p-6">
            <div className="space-y-6">
              <TextField label="실제 결과" value={detail.actualResult} />
              <TextField label="예상 결과" value={detail.expectedResult} />
              <TextField label="재현 단계" value={detail.reproductionSteps} />
              <TextField label="발생 위치" value={detail.location} />
              <TextField label="환경" value={detail.environment} />
            </div>
          </div>

          <aside className="min-w-0 space-y-5">
            {deliveries.length > 0 && (
              <section className="rounded-lg border border-zinc-200 bg-white p-5">
                <h2 className="text-sm font-semibold">Discord 수정 알림</h2>
                <ul className="mt-3 space-y-2 text-sm">
                  {deliveries.map((delivery) => (
                    <li key={delivery.id}>
                      {{ queued: "대기 중", processing: "발송 중", sent: "발송 완료", failed: "확인 필요" }[delivery.status]}
                      {delivery.explanation && <p className="text-xs text-zinc-600">{delivery.explanation}</p>}
                    </li>
                  ))}
                </ul>
              </section>
            )}
            <section className="rounded-lg border border-zinc-200 bg-white p-5">
              <h2 className="text-sm font-semibold">제보 정보</h2>
              <dl className="mt-4 space-y-4 text-sm">
                <div>
                  <dt className="text-xs font-medium text-zinc-500">발생 빌드</dt>
                  <dd className="mt-1 break-words font-medium">{detail.build.version}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-zinc-500">수정 빌드</dt>
                  <dd className="mt-1 break-words font-medium">
                    {detail.fixedBuild?.version ?? "미정"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-zinc-500">플랫폼</dt>
                  <dd className="mt-1 break-words">{detail.platform}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-zinc-500">발생 빈도</dt>
                  <dd className="mt-1 break-words">{detail.frequency}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-zinc-500">중복 제보</dt>
                  <dd className="mt-1">{detail.duplicateCount}건</dd>
                </div>
                <div>
                  <dt className="flex items-center gap-1.5 text-xs font-medium text-zinc-500">
                    <UserRound className="size-3.5" aria-hidden="true" /> 제보자
                  </dt>
                  <dd className="mt-1 break-all">
                    {detail.reporterDisplayName}
                    <span className="block text-xs text-zinc-500">
                      Discord ID: {detail.reporterDiscordUserId}
                    </span>
                  </dd>
                </div>
              </dl>
            </section>

            <section className="rounded-lg border border-zinc-200 bg-white p-5">
              <h2 className="flex items-center gap-2 text-sm font-semibold">
                <Paperclip className="size-4" aria-hidden="true" /> 첨부파일
              </h2>
              {detail.attachments.length === 0 ? (
                <p className="mt-4 text-sm text-zinc-500">첨부파일이 없습니다.</p>
              ) : (
                <ul className="mt-4 space-y-3">
                  {detail.attachments.map((attachment) => (
                    <li key={attachment.id} className="min-w-0 rounded-md bg-zinc-100 p-3">
                      <p className="break-all text-sm font-medium">{attachment.originalFilename}</p>
                      <p className="mt-1 text-xs text-zinc-500">
                        {attachment.contentType} · {formatBytes(attachment.sizeBytes)}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </aside>
        </div>

        <section className="mt-5 rounded-lg border border-zinc-200 bg-white p-5 sm:p-6">
          <h2 className="flex items-center gap-2 text-base font-semibold">
            <FileText className="size-4" aria-hidden="true" /> 처리 이력
          </h2>
          <div className="mt-5">
            <Timeline events={detail.statusEvents} />
          </div>
        </section>
      </section>
    </main>
  );
}

export default async function ReportDetailPage({
  params,
  searchParams,
}: ReportDetailPageProps) {
  let projectId = "";
  let reportId = "";
  let detail: ReportDetail | null = null;
  let canManageDuplicates = false;
  let builds: BuildSummary[] = [];
  let deliveries: Delivery[] = [];
  let loadError: unknown = null;

  try {
    const parsed = ProjectReportIdParamsSchema.parse(await params);
    projectId = parsed.projectId;
    reportId = parsed.reportId;
    const guards = getAuthGuards();
    detail = await getAccessibleReportDetail(
      guards,
      getReportDetailQueryRepository(),
      parsed.reportId,
      parsed.projectId,
    );
    const membership = await guards.requireProjectMember(parsed.projectId);
    canManageDuplicates = membership.role === "owner" || membership.role === "admin";
    if (detail.status === "reproduced" && canManageDuplicates) {
      builds = await listAccessibleProjectBuilds(
        guards,
        getBuildQueryRepository(),
        parsed.projectId,
      );
    }
    if (detail.status === "fixed" && canManageDuplicates && process.env.REPROLOOP_MODE === "local") {
      deliveries = await getDatabase().select({
        id: notifications.id, status: notifications.status, explanation: notifications.lastErrorMessage,
      }).from(notifications).where(eq(notifications.reportId, detail.id));
    }
  } catch (error) {
    loadError = error;
  }

  const query = await searchParams;
  const returnTo = Array.isArray(query.returnTo) ? query.returnTo[0] : query.returnTo;
  const reportsHref = resolveReportsReturnHref(projectId, returnTo);

  return detail ? (
    <ReportDetailView
      detail={detail}
      reportsHref={reportsHref}
      canManageDuplicates={canManageDuplicates}
      builds={builds}
      deliveries={deliveries}
    />
  ) : (
    <ErrorState
      error={loadError}
      projectId={projectId}
      reportId={reportId}
      reportsHref={reportsHref}
    />
  );
}
