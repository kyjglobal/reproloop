import Link from "next/link";

import {
  addBuild, addProject, addTeamMember, connectDiscord, disconnectDiscord, updateTeamMember,
} from "./actions";
import { getLocalMembership, getLocalSettings, settingsMessages } from "./data";

export const dynamic = "force-dynamic";

const panel = "space-y-4 rounded-lg border border-zinc-200 bg-white p-5";
const field = "min-w-0 rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm";
const button = "rounded-md bg-zinc-950 px-4 py-2 text-sm text-white";

function botInvite() {
  const applicationId = process.env.REPROLOOP_DISCORD_APPLICATION_ID?.trim();
  if (!applicationId || !/^\d{1,20}$/.test(applicationId)) return null;
  const url = new URL("https://discord.com/oauth2/authorize");
  url.search = new URLSearchParams({
    client_id: applicationId, scope: "bot applications.commands", permissions: "0", integration_type: "0",
  }).toString();
  return url.href;
}

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ result?: string }> }) {
  const membership = await getLocalMembership();
  const owner = membership.role === "owner";
  const manager = membership.role !== "member";
  const { guild, connected, projects, versions, team } = await getLocalSettings(membership.organizationId, owner);
  const { result } = await searchParams;
  const message = result && Object.hasOwn(settingsMessages, result)
    ? settingsMessages[result as keyof typeof settingsMessages]
    : null;
  const invite = botInvite();

  return (
    <main className="min-h-screen bg-zinc-50">
      <div className="mx-auto grid w-full max-w-3xl gap-5 p-5 sm:py-10">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm text-zinc-600">{membership.organizationName}</p>
            <h1 className="mt-1 text-2xl font-semibold">설치 설정</h1>
          </div>
          <nav className="flex gap-4 text-sm">
            <Link className="underline" href="/projects">프로젝트</Link>
            <Link className="underline" href="/api/auth/signout">로그아웃</Link>
          </nav>
        </header>
        {message && <p role="status" className="rounded-md border bg-white p-3 text-sm">{message}</p>}
        <section className={panel}>
          <h2 className="font-semibold">Discord 연결</h2>
          <p className="text-sm">
            {guild && <span className="mr-2 font-medium">{guild.name}</span>}
            {connected ? "연결됨" : guild && !guild.removedAt ? "연결 대기 중" : "연결 필요"}
          </p>
          {owner && <>
            {invite && <a href={invite} target="_blank" rel="noreferrer" className="text-sm underline">Discord에 봇 추가</a>}
            {!invite && <p className="text-sm text-zinc-600">봇 초대 링크를 사용하려면 제공 봇의 애플리케이션 ID를 설정하세요.</p>}
            <p className="text-sm text-zinc-600">서버 관리 권한이 있는 Discord 계정에서 <code>/reproloop connect</code>를 실행하고 코드를 입력하세요.</p>
            <form action={connectDiscord} className="flex flex-wrap items-end gap-2">
              <label className="grid gap-1 text-sm">연결 코드<input className={field} name="code" maxLength={16} autoComplete="off" required /></label>
              <button className={button}>서버 연결</button>
            </form>
            <div className="flex flex-wrap gap-4 text-sm">
              <a className="underline" href="/settings">연결 상태 새로고침</a>
              {guild && !guild.removedAt && <form action={disconnectDiscord}><button className="underline">연결 해제</button></form>}
            </div>
          </>}
        </section>
        <section className={panel}>
          <h2 className="font-semibold">프로젝트와 빌드</h2>
          {manager && guild && !guild.removedAt && <form action={addProject} className="flex flex-wrap items-end gap-2">
            <label className="grid gap-1 text-sm">프로젝트 이름<input className={field} name="name" maxLength={80} required /></label>
            <button className={button}>프로젝트 등록</button>
          </form>}
          {projects.length === 0 && <p className="text-sm text-zinc-600">Discord 연결 후 첫 프로젝트를 등록하세요.</p>}
          <ul className="divide-y">
            {projects.map((project) => <li key={project.id} className="grid gap-2 py-3">
              <Link className="w-fit text-sm font-medium underline" href={`/projects/${project.id}/reports`}>{project.name} 제보함</Link>
              <p className="text-sm text-zinc-600">
                {versions.filter((entry) => entry.projectId === project.id).map((entry) => entry.version).join(", ") || "활성 빌드 없음"}
              </p>
              {manager && <form action={addBuild} className="flex flex-wrap items-end gap-2">
                <input type="hidden" name="projectId" value={project.id} />
                <label className="grid gap-1 text-sm">빌드 버전<input className={field} name="version" placeholder="0.8.14-beta" maxLength={100} required /></label>
                <button className={button}>빌드 등록</button>
              </form>}
            </li>)}
          </ul>
        </section>
        {owner && <section className={panel}>
          <h2 className="font-semibold">팀 계정</h2>
          <form action={addTeamMember} className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1 text-sm">팀원 아이디<input className={field} name="username" minLength={3} maxLength={40} required /></label>
            <label className="grid gap-1 text-sm">팀원 표시 이름<input className={field} name="displayName" maxLength={80} required /></label>
            <label className="grid gap-1 text-sm">팀원 비밀번호<input className={field} name="password" type="password" autoComplete="new-password" minLength={12} maxLength={128} required /></label>
            <label className="grid gap-1 text-sm">역할<select className={field} name="role"><option value="member">member</option><option value="admin">admin</option></select></label>
            <button className={button}>팀원 추가</button>
          </form>
          <ul className="divide-y">
            {team.map((user) => <li key={user.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
              <span>{user.name} · {user.role}</span>
              {user.role !== "owner" && <form action={updateTeamMember} className="flex gap-2">
                <input type="hidden" name="id" value={user.id} />
                <select aria-label={`${user.name} 역할`} className={field} name="role" defaultValue={user.role}>
                  <option value="member">member</option><option value="admin">admin</option><option value="disabled">비활성화</option>
                </select>
                <button className={button}>저장</button>
              </form>}
            </li>)}
          </ul>
        </section>}
      </div>
    </main>
  );
}
