export default function ReportDetailLoading() {
  return (
    <main className="min-h-screen bg-zinc-50 px-4 py-8 text-zinc-950 sm:px-6 lg:px-8">
      <section
        aria-label="제보 상세 불러오는 중"
        className="mx-auto max-w-6xl animate-pulse space-y-5"
      >
        <div className="h-5 w-36 rounded bg-zinc-200" />
        <div className="h-28 rounded-lg border border-zinc-200 bg-white" />
        <div className="grid gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">
          <div className="h-[560px] rounded-lg border border-zinc-200 bg-white" />
          <div className="h-[420px] rounded-lg border border-zinc-200 bg-white" />
        </div>
      </section>
    </main>
  );
}
