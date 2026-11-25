import type { ProjectSummary } from "@reproloop/shared";
import { AlertTriangle, FolderOpen, LogIn } from "lucide-react";
import Link from "next/link";

import { AuthAccessError } from "@/server/auth/errors";
import { getAuthGuards } from "@/server/auth/runtime";
import { getProjectQueryRepository } from "@/server/projects/runtime";
import { listAccessibleProjects } from "@/server/projects/service";

export const dynamic = "force-dynamic";

async function loadProjects() {
  try {
    return {
      projects: await listAccessibleProjects(
        getAuthGuards(),
        getProjectQueryRepository(),
      ),
      error: null,
    };
  } catch (error) {
    return { projects: [], error };
  }
}

function AuthRequired() {
  const local = process.env.REPROLOOP_MODE === "local";
  return (
    <main className="min-h-screen bg-zinc-50 px-4 py-10 text-zinc-950 sm:px-6 lg:px-8">
      <section className="mx-auto flex min-h-[70vh] max-w-xl flex-col items-center justify-center text-center">
        <div className="mb-6 flex size-12 items-center justify-center rounded-lg border border-zinc-200 bg-white">
          <LogIn className="size-5" aria-hidden="true" />
        </div>
        <h1 className="text-2xl font-semibold tracking-normal">로그인이 필요합니다</h1>
        <p className="mt-3 text-sm leading-6 text-zinc-600">
          프로젝트와 제보 목록을 보려면 로그인하세요.
        </p>
        <Link
          href={local ? "/login" : "/api/auth/signin?callbackUrl=/projects"}
          className="mt-6 inline-flex h-10 items-center rounded-md bg-zinc-950 px-4 text-sm font-medium text-white hover:bg-zinc-800"
        >
          {local ? "로그인" : "Discord 로그인"}
        </Link>
      </section>
    </main>
  );
}

function ErrorState() {
  return (
    <main className="min-h-screen bg-zinc-50 px-4 py-10 text-zinc-950 sm:px-6 lg:px-8">
      <section className="mx-auto flex min-h-[70vh] max-w-xl flex-col items-center justify-center text-center">
        <div className="mb-6 flex size-12 items-center justify-center rounded-lg border border-red-200 bg-red-50 text-red-700">
          <AlertTriangle className="size-5" aria-hidden="true" />
        </div>
        <h1 className="text-2xl font-semibold tracking-normal">프로젝트를 불러오지 못했습니다</h1>
        <p className="mt-3 text-sm leading-6 text-zinc-600">
          잠시 후 다시 시도하거나 개발 서버의 환경변수와 DB 연결을 확인해 주세요.
        </p>
      </section>
    </main>
  );
}

function EmptyProjects() {
  return (
    <div className="rounded-lg border border-dashed border-zinc-300 bg-white px-6 py-12 text-center">
      <FolderOpen className="mx-auto size-8 text-zinc-400" aria-hidden="true" />
      <h2 className="mt-4 text-base font-semibold">접근 가능한 프로젝트가 없습니다</h2>
      <p className="mt-2 text-sm leading-6 text-zinc-600">
        조직 멤버십 또는 프로젝트 연결이 준비되면 이 화면에 프로젝트가 표시됩니다.
      </p>
    </div>
  );
}

function ProjectRow({ project }: { project: ProjectSummary }) {
  return (
    <Link
      href={`/projects/${project.id}/reports`}
      className="grid gap-3 border-b border-zinc-200 px-4 py-4 transition-colors last:border-b-0 hover:bg-zinc-50 sm:grid-cols-[1fr_160px_96px]"
    >
      <div>
        <div className="font-medium text-zinc-950">{project.name}</div>
        <div className="mt-1 text-sm text-zinc-500">{project.organizationName}</div>
      </div>
      <div className="text-sm text-zinc-600 sm:text-right">{project.slug}</div>
      <div className="text-sm font-medium text-zinc-700 sm:text-right">{project.role}</div>
    </Link>
  );
}

export default async function ProjectsPage() {
  const { projects, error } = await loadProjects();

  if (error instanceof AuthAccessError && error.code === "UNAUTHENTICATED") {
    return <AuthRequired />;
  }

  if (error) {
    return <ErrorState />;
  }

  return (
    <main className="min-h-screen bg-zinc-50 text-zinc-950">
      <section className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        <header className="mb-6 flex flex-col gap-2 border-b border-zinc-200 pb-5">
          <p className="text-sm font-medium text-zinc-500">ReproLoop</p>
          <h1 className="text-2xl font-semibold tracking-normal">프로젝트</h1>
          {process.env.REPROLOOP_MODE === "local" && <Link className="w-fit text-sm underline" href="/settings">설치 설정</Link>}
        </header>

        {projects.length === 0 ? (
          <EmptyProjects />
        ) : (
          <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white">
            <div className="hidden grid-cols-[1fr_160px_96px] border-b border-zinc-200 bg-zinc-100 px-4 py-3 text-xs font-semibold uppercase text-zinc-500 sm:grid">
              <span>Project</span>
              <span className="text-right">Slug</span>
              <span className="text-right">Role</span>
            </div>
            {projects.map((project) => (
              <ProjectRow key={project.id} project={project} />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
