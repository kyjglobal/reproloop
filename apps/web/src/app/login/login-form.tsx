"use client";

import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

export function LoginForm() {
  const router = useRouter();
  const [error, setError] = useState(false);
  const [working, setWorking] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setWorking(true);
    setError(false);
    try {
      const response = await signIn("credentials", { redirect: false, ...Object.fromEntries(form) });
      if (response?.ok && !response.error) {
        router.replace("/projects");
        router.refresh();
        return;
      }
      setError(true);
    } catch {
      setError(true);
    } finally {
      setWorking(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-6 grid gap-4">
      <label className="grid gap-1 text-sm">아이디<input className="rounded-md border p-2" name="username" autoComplete="username" required /></label>
      <label className="grid gap-1 text-sm">비밀번호<input className="rounded-md border p-2" name="password" type="password" autoComplete="current-password" required /></label>
      {error && <p role="alert" className="text-sm text-red-700">로그인할 수 없습니다. 아이디와 비밀번호를 확인해 주세요.</p>}
      <button disabled={working} className="rounded-md bg-zinc-950 p-2 text-white disabled:opacity-50">
        {working ? "로그인 중" : "로그인"}
      </button>
    </form>
  );
}
