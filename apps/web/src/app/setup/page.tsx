import { notFound, redirect } from "next/navigation";

import { localSetupNeeded } from "@/server/auth/local-accounts";

import { setupOwner } from "./actions";

export const dynamic = "force-dynamic";

export default async function SetupPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  if (process.env.REPROLOOP_MODE !== "local") notFound();
  if (!await localSetupNeeded()) redirect("/login");
  const { error } = await searchParams;
  return (
    <main className="mx-auto w-full max-w-lg p-6 sm:py-12">
      <p className="mb-2 text-sm font-medium text-zinc-600">ReproLoop</p>
      <h1 className="text-3xl font-semibold">초기 설정</h1>
      <p className="mt-3 text-sm text-zinc-600">설치한 기기에서 아래 명령으로 설정 코드를 확인하세요.</p>
      <pre className="mt-2 overflow-x-auto rounded-md bg-zinc-100 p-3 text-sm">docker compose exec web cat /run/reproloop/setup-token</pre>
      <form action={setupOwner} className="mt-6 grid gap-4">
        <label className="grid gap-1 text-sm">설정 코드<input className="rounded-md border p-2" name="setupToken" type="password" autoComplete="off" required /></label>
        <label className="grid gap-1 text-sm">팀 이름<input className="rounded-md border p-2" name="team" maxLength={80} required /></label>
        <label className="grid gap-1 text-sm">표시 이름<input className="rounded-md border p-2" name="displayName" maxLength={80} required /></label>
        <label className="grid gap-1 text-sm">아이디<input className="rounded-md border p-2" name="username" autoComplete="username" pattern="[A-Za-z0-9._\u002D]{3,40}" required />
          <span className="text-xs text-zinc-500">영문, 숫자, 점, 밑줄, 하이픈 3~40자</span>
        </label>
        <label className="grid gap-1 text-sm">비밀번호<input className="rounded-md border p-2" name="password" type="password" autoComplete="new-password" minLength={12} maxLength={128} required /></label>
        {error && <p role="alert" className="text-sm text-red-700">설정 코드와 입력 항목을 확인해 주세요.</p>}
        <button className="rounded-md bg-zinc-950 p-2 text-white">관리자 계정 만들기</button>
      </form>
    </main>
  );
}
