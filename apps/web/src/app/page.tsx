import { redirect } from "next/navigation";
import { localSetupNeeded } from "@/server/auth/local-accounts";

export const dynamic = "force-dynamic";

export default async function Home() {
  if (process.env.REPROLOOP_MODE === "broker") {
    return <main className="p-8">ReproLoop Discord</main>;
  }
  if (process.env.REPROLOOP_MODE === "local" && await localSetupNeeded()) redirect("/setup");
  redirect("/projects");
}
