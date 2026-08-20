const LOCAL_ORIGIN = "https://reproloop.local";

export function buildReportDetailHref(
  projectId: string,
  reportId: string,
  reportsHref?: string,
) {
  const detailHref = `/projects/${projectId}/reports/${reportId}`;

  if (!reportsHref) {
    return detailHref;
  }

  const search = new URLSearchParams({ returnTo: reportsHref });
  return `${detailHref}?${search.toString()}`;
}

export function resolveReportsReturnHref(projectId: string, value: unknown) {
  const fallbackHref = `/projects/${projectId}/reports`;

  if (typeof value !== "string") {
    return fallbackHref;
  }

  try {
    const candidate = new URL(value, LOCAL_ORIGIN);

    if (
      candidate.origin !== LOCAL_ORIGIN ||
      candidate.pathname !== fallbackHref ||
      candidate.hash
    ) {
      return fallbackHref;
    }

    return `${candidate.pathname}${candidate.search}`;
  } catch {
    return fallbackHref;
  }
}
