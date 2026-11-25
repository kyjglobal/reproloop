import { notFound, redirect } from "next/navigation";

import { localSetupNeeded } from "@/server/auth/local-accounts";

import { LoginForm } from "./login-form";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  if (process.env.REPROLOOP_MODE !== "local") notFound();
  if (await localSetupNeeded()) redirect("/setup");
  return (
    <main className="mx-auto w-full max-w-md p-6 sm:py-12">
      <p className="mb-2 text-sm font-medium text-zinc-600">ReproLoop</p>
      <h1 className="text-3xl font-semibold">로그인</h1>
      <LoginForm />
    </main>
  );
}
