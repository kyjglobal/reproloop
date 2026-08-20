import {
  REPORT_STATUSES,
  ReportListQuerySchema,
  type BuildSummary,
  type ReportListItem,
  type ReportStatus,
} from "@reproloop/shared";
import {
  AlertTriangle,
  ArrowLeft,
  ChevronsRight,
  Inbox,
  RotateCw,
  Search,
} from "lucide-react";
import Link from "next/link";

import { ProjectIdParamsSchema } from "@/server/api/params";
import { AuthAccessError } from "@/server/auth/errors";
import { getAuthGuards } from "@/server/auth/runtime";
import { getBuildQueryRepository } from "@/server/builds/runtime";
import { listAccessibleProjectBuilds } from "@/server/builds/service";
import { getProjectQueryRepository } from "@/server/projects/runtime";
import { getAccessibleProject } from "@/server/projects/service";
import { getReportListQueryRepository } from "@/server/reports/runtime";
import { listAccessibleProjectReports } from "@/server/reports/service";

export const dynamic = "force-dynamic";

interface ReportsPageProps {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

const statusLabels: Record<ReportStatus, string> = {
  new: "신규",
  needs_info: "정보 요청",
  investigating: "조사 중",
  reproduced: "재현됨",
  fixed: "수정됨",
  duplicate: "중복",
};

const severityLabels = {
  low: "낮음",
  medium: "보통",
  high: "높음",
  critical: "긴급",
} as const;

function firstValue(value: string | string[] | undefined) {
  const selected = Array.isArray(value) ? value[0] : value;
  return selected && selected.trim().length > 0 ? selected : undefined;
}

function normalizeSearchParams(input: Record<string, string | string[] | undefined>) {
  return {
    status: input.status,
    buildId: firstValue(input.buildId),
    search: firstValue(input.search),
    limit: firstValue(input.limit),
    cursor: firstValue(input.cursor),
  };
}

function buildReportsHref(
  projectId: string,
  params: {
    status?: ReportStatus[];
    buildId?: string;
    search?: string;
    limit?: number;
    cursor?: string | null;
  },
) {
  const search = new URLSearchParams();

  if (params.status && params.status.length > 0) {
    search.set("status", params.status.join(","));
  }

  if (params.buildId) {
    search.set("buildId", params.buildId);
  }

  if (params.search) {
    search.set("search", params.search);
  }

  if (params.limit) {
    search.set("limit", String(params.limit));
  }

  if (params.cursor) {
    search.set("cursor", params.cursor);
  }

  const query = search.toString();
  return query ? `/projects/${projectId}/reports?${query}` : `/projects/${projectId}/reports`;
}

async function loadReportsPage(
  projectId: string,
  searchParams: Record<string, string | string[] | undefined>,
) {
  try {
    const query = ReportListQuerySchema.parse(normalizeSearchParams(searchParams));
    const guards = getAuthGuards();
    const [project, builds, reportPage] = await Promise.all([
      getAccessibleProject(guards, getProjectQueryRepository(), projectId),
      listAccessibleProjectBuilds(guards, getBuildQueryRepository(), projectId),
      listAccessibleProjectReports(
        guards,
        getReportListQueryRepository(),
        projectId,
        query,
      ),
    ]);

    return { project, builds, reportPage, query, error: null };
  } catch (error) {
    return {
      project: null,
      builds: [],
      reportPage: { items: [], nextCursor: null },
      query: ReportListQuerySchema.parse({}),
      error,
    };
  }
}

function AuthRequired() {
  return (
    <main className="min-h-screen bg-zinc-50 px-4 py-10 text-zinc-950 sm:px-6 lg:px-8">
      <section className="mx-auto flex min-h-[70vh] max-w-xl flex-col items-center justify-center text-center">
        <h1 className="text-2xl font-semibold tracking-normal">로그인이 필요합니다</h1>
        <p className="mt-3 text-sm leading-6 text-zinc-600">
          제보 목록은 Discord로 로그인한 개발자만 볼 수 있습니다.
        </p>
        <Link
          href="/api/auth/signin?callbackUrl=/projects"
          className="mt-6 inline-flex h-10 items-center rounded-md bg-zinc-950 px-4 text-sm font-medium text-white hover:bg-zinc-800"
        >
          Discord 로그인
        </Link>
      </section>
    </main>
  );
}

function ErrorState({ error }: { error: unknown }) {
  const isForbidden = error instanceof AuthAccessError && error.code === "FORBIDDEN";

  return (
    <main className="min-h-screen bg-zinc-50 px-4 py-10 text-zinc-950 sm:px-6 lg:px-8">
      <section className="mx-auto flex min-h-[70vh] max-w-xl flex-col items-center justify-center text-center">
        <div className="mb-6 flex size-12 items-center justify-center rounded-lg border border-red-200 bg-red-50 text-red-700">
          <AlertTriangle className="size-5" aria-hidden="true" />
        </div>
        <h1 className="text-2xl font-semibold tracking-normal">
          {isForbidden ? "프로젝트 권한이 없습니다" : "제보 목록을 불러오지 못했습니다"}
        </h1>
        <p className="mt-3 text-sm leading-6 text-zinc-600">
          {isForbidden
            ? "이 프로젝트의 조직 멤버만 제보 목록을 볼 수 있습니다."
            : "필터 값, 환경변수, DB 연결 상태를 확인해 주세요."}
        </p>
        <Link
          href="/projects"
          className="mt-6 inline-flex h-10 items-center rounded-md border border-zinc-300 bg-white px-4 text-sm font-medium text-zinc-800 hover:bg-zinc-100"
        >
          프로젝트로 돌아가기
        </Link>
      </section>
    </main>
  );
}

function FilterBar({
  projectId,
  query,
  builds,
}: {
  projectId: string;
  query: {
    status?: ReportStatus[];
    buildId?: string;
    search?: string;
    limit: number;
  };
  builds: BuildSummary[];
}) {
  const selectedStatuses = new Set(query.status ?? []);

  return (
    <form
      action={`/projects/${projectId}/reports`}
      className="grid gap-4 border-b border-zinc-200 bg-white p-4 lg:grid-cols-[1fr_220px_auto]"
    >
      <div>
        <label
          htmlFor="report-search"
          className="mb-2 block text-xs font-semibold uppercase text-zinc-500"
        >
          Search
        </label>
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-400"
            aria-hidden="true"
          />
          <input
            id="report-search"
            name="search"
            defaultValue={query.search ?? ""}
            placeholder="제목 검색"
            className="h-10 w-full rounded-md border border-zinc-300 bg-white pl-9 pr-3 text-sm outline-none focus:border-zinc-500"
          />
        </div>
      </div>

      <div>
        <label
          htmlFor="build-filter"
          className="mb-2 block text-xs font-semibold uppercase text-zinc-500"
        >
          Build
        </label>
        <select
          id="build-filter"
          name="buildId"
          defaultValue={query.buildId ?? ""}
          className="h-10 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm outline-none focus:border-zinc-500"
        >
          <option value="">전체 빌드</option>
          {builds.map((build) => (
            <option key={build.id} value={build.id}>
              {build.isActive ? build.version : `${build.version} (비활성)`}
            </option>
          ))}
        </select>
      </div>

      <input type="hidden" name="limit" value={query.limit} />

      <div className="flex items-end gap-2">
        <button
          type="submit"
          className="inline-flex h-10 items-center gap-2 rounded-md bg-zinc-950 px-4 text-sm font-medium text-white hover:bg-zinc-800"
        >
          <RotateCw className="size-4" aria-hidden="true" />
          적용
        </button>
        <Link
          href={`/projects/${projectId}/reports`}
          className="inline-flex h-10 items-center rounded-md border border-zinc-300 bg-white px-4 text-sm font-medium text-zinc-800 hover:bg-zinc-100"
        >
          초기화
        </Link>
      </div>

      <fieldset className="lg:col-span-3">
        <legend className="mb-2 text-xs font-semibold uppercase text-zinc-500">
          Status
        </legend>
        <div className="flex flex-wrap gap-2">
          {REPORT_STATUSES.map((status) => (
            <label
              key={status}
              className="inline-flex h-9 items-center gap-2 rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-700"
            >
              <input
                type="checkbox"
                name="status"
                value={status}
                defaultChecked={selectedStatuses.has(status)}
                className="size-4 accent-zinc-950"
              />
              {statusLabels[status]}
            </label>
          ))}
        </div>
      </fieldset>
    </form>
  );
}

function EmptyReports() {
  return (
    <div className="px-6 py-16 text-center">
      <Inbox className="mx-auto size-8 text-zinc-400" aria-hidden="true" />
      <h2 className="mt-4 text-base font-semibold">표시할 제보가 없습니다</h2>
      <p className="mt-2 text-sm leading-6 text-zinc-600">
        Discord /bug로 제보가 접수되거나 필터를 변경하면 목록에 표시됩니다.
      </p>
    </div>
  );
}

function StatusBadge({ status }: { status: ReportStatus }) {
  return (
    <span className="inline-flex min-w-20 justify-center rounded-md border border-zinc-200 bg-zinc-100 px-2 py-1 text-xs font-medium text-zinc-700">
      {statusLabels[status]}
    </span>
  );
}

function ReportTable({ reports }: { reports: ReportListItem[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[880px] border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-zinc-200 bg-zinc-100 text-xs uppercase text-zinc-500">
            <th className="px-4 py-3 font-semibold">No.</th>
            <th className="px-4 py-3 font-semibold">Title</th>
            <th className="px-4 py-3 font-semibold">Status</th>
            <th className="px-4 py-3 font-semibold">Severity</th>
            <th className="px-4 py-3 font-semibold">Build</th>
            <th className="px-4 py-3 font-semibold">Reporter</th>
            <th className="px-4 py-3 text-right font-semibold">Duplicates</th>
            <th className="px-4 py-3 font-semibold">Created</th>
          </tr>
        </thead>
        <tbody>
          {reports.map((report) => (
            <tr key={report.id} className="border-b border-zinc-200 last:border-b-0">
              <td className="whitespace-nowrap px-4 py-4 font-medium text-zinc-950">
                <Link
                  href={`/projects/${report.projectId}/reports/${report.id}`}
                  className="hover:underline"
                >
                  BUG-{report.reportNumber}
                </Link>
              </td>
              <td className="max-w-[280px] px-4 py-4 text-zinc-950">
                <Link
                  href={`/projects/${report.projectId}/reports/${report.id}`}
                  className="line-clamp-2 hover:underline"
                >
                  {report.title}
                </Link>
              </td>
              <td className="px-4 py-4">
                <StatusBadge status={report.status} />
              </td>
              <td className="whitespace-nowrap px-4 py-4 text-zinc-700">
                {severityLabels[report.severity]}
              </td>
              <td className="whitespace-nowrap px-4 py-4 text-zinc-700">
                {report.build.version}
              </td>
              <td className="whitespace-nowrap px-4 py-4 text-zinc-700">
                {report.reporterDisplayName}
              </td>
              <td className="px-4 py-4 text-right text-zinc-700">
                {report.duplicateCount}
              </td>
              <td className="whitespace-nowrap px-4 py-4 text-zinc-500">
                {new Intl.DateTimeFormat("ko-KR", {
                  month: "2-digit",
                  day: "2-digit",
                  hour: "2-digit",
                  minute: "2-digit",
                }).format(new Date(report.createdAt))}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default async function ReportsPage({ params, searchParams }: ReportsPageProps) {
  const { projectId } = ProjectIdParamsSchema.parse(await params);
  const { project, builds, reportPage, query, error } = await loadReportsPage(
    projectId,
    await searchParams,
  );

  if (error instanceof AuthAccessError && error.code === "UNAUTHENTICATED") {
    return <AuthRequired />;
  }

  if (error || !project) {
    return <ErrorState error={error} />;
  }

  return (
    <main className="min-h-screen bg-zinc-50 text-zinc-950">
      <section className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <header className="mb-6 flex flex-col gap-4 border-b border-zinc-200 pb-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <Link
              href="/projects"
              className="mb-4 inline-flex items-center gap-2 text-sm font-medium text-zinc-600 hover:text-zinc-950"
            >
              <ArrowLeft className="size-4" aria-hidden="true" />
              프로젝트
            </Link>
            <p className="text-sm font-medium text-zinc-500">
              {project.organizationName} / {project.slug}
            </p>
            <h1 className="mt-1 text-2xl font-semibold tracking-normal">
              {project.name} 제보 목록
            </h1>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:flex">
            <div className="rounded-md border border-zinc-200 bg-white px-4 py-3">
              <div className="text-xs font-medium uppercase text-zinc-500">Reports</div>
              <div className="mt-1 text-xl font-semibold">{reportPage.items.length}</div>
            </div>
            <div className="rounded-md border border-zinc-200 bg-white px-4 py-3">
              <div className="text-xs font-medium uppercase text-zinc-500">Builds</div>
              <div className="mt-1 text-xl font-semibold">{builds.length}</div>
            </div>
          </div>
        </header>

        <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white">
          <FilterBar projectId={project.id} query={query} builds={builds} />
          {reportPage.items.length === 0 ? (
            <EmptyReports />
          ) : (
            <ReportTable reports={reportPage.items} />
          )}
        </div>

        {reportPage.nextCursor ? (
          <div className="mt-5 flex justify-center">
            <Link
              href={buildReportsHref(project.id, {
                ...query,
                cursor: reportPage.nextCursor,
              })}
              className="inline-flex h-10 items-center gap-2 rounded-md border border-zinc-300 bg-white px-4 text-sm font-medium text-zinc-800 hover:bg-zinc-100"
            >
              더 보기
              <ChevronsRight className="size-4" aria-hidden="true" />
            </Link>
          </div>
        ) : null}
      </section>
    </main>
  );
}
