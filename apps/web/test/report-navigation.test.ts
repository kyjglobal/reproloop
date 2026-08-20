import { describe, expect, it } from "vitest";

import {
  buildReportDetailHref,
  resolveReportsReturnHref,
} from "../src/server/reports/navigation";

const projectId = "11111111-1111-4111-8111-111111111111";
const reportId = "22222222-2222-4222-8222-222222222222";

describe("report navigation", () => {
  it("carries the filtered list location into the detail URL", () => {
    const reportsHref =
      `/projects/${projectId}/reports?status=new%2Creproduced&search=freeze&limit=20`;

    const detailHref = buildReportDetailHref(projectId, reportId, reportsHref);

    expect(new URL(detailHref, "https://reproloop.local").searchParams.get("returnTo"))
      .toBe(reportsHref);
  });

  it("restores only the matching project's report list", () => {
    const reportsHref = `/projects/${projectId}/reports?status=new&cursor=next-page`;

    expect(resolveReportsReturnHref(projectId, reportsHref)).toBe(reportsHref);
    expect(resolveReportsReturnHref(projectId, "https://example.com/phishing")).toBe(
      `/projects/${projectId}/reports`,
    );
    expect(
      resolveReportsReturnHref(
        projectId,
        "/projects/33333333-3333-4333-8333-333333333333/reports",
      ),
    ).toBe(`/projects/${projectId}/reports`);
  });
});
