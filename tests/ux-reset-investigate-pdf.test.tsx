import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { downloadInvestigatePdf } from "@/features/ux-reset/investigate/download-investigate-pdf";
import {
  investigateCountyReportExportOffer,
  type InvestigatePdfContext,
} from "@/features/ux-reset/investigate/investigate-next-step";
import { InvestigatePdfExport } from "@/features/ux-reset/investigate/investigate-pdf-export";
import { getCountyReportPdfV1CountiesFipsReportPdfGetUrl } from "@/generated/atlas";
import type { Observation } from "@/generated/models";

import {
  investigateObservationsFor,
  INVESTIGATE_TICK_MEASURE_ID,
} from "./fixtures/investigate-api-fixtures";

const api = vi.hoisted(() => ({
  observations:
    vi.fn<typeof import("@/generated/atlas").observationsV1ObservationsGet>(),
  report:
    vi.fn<
      typeof import("@/generated/atlas").countyReportPdfV1CountiesFipsReportPdfGet
    >(),
}));
vi.mock(import("@/generated/atlas"), async (original) => ({
  ...(await original<typeof import("@/generated/atlas")>()),
  observationsV1ObservationsGet: api.observations,
  countyReportPdfV1CountiesFipsReportPdfGet: api.report,
}));

function context(): InvestigatePdfContext {
  const observations = investigateObservationsFor({
    fips: "08001",
    measureId: INVESTIGATE_TICK_MEASURE_ID,
    scenario: "mixed",
  }).map((observation) => ({
    ...observation,
    measure_id: "tick_survey",
    lineage_source_id: "tick-lineage",
  }));
  return {
    observations,
    countyFips: "08001",
    releaseId: "alpha-2026",
    requestedPeriod: "2023-01-01",
    periods: ["2023"],
    sources: ["Tick survey"],
    caveats: ["Surveillance sites do not represent the whole county."],
  };
}
function observationResponse(
  observations: readonly Observation[],
  next: string | null = null
) {
  return {
    status: 200 as const,
    headers: new Headers(),
    data: {
      data: [...observations],
      meta: { next_page_token: next },
      links: { self: "/v1/observations", next: null },
    },
  };
}
function pdfResponse() {
  return {
    status: 200 as const,
    headers: new Headers({
      "content-type": "application/pdf",
      "cache-control": "no-store",
    }),
    data: new Blob(["%PDF-1.7 fixture"], { type: "application/pdf" }),
  };
}
describe("Investigate canonical PDF", () => {
  let click: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    api.observations
      .mockReset()
      .mockResolvedValue(observationResponse(context().observations ?? []));
    api.report.mockReset().mockResolvedValue(pdfResponse());
    vi.stubGlobal(
      "URL",
      Object.assign(URL, {
        createObjectURL: vi.fn<() => string>(() => "blob:pdf"),
        revokeObjectURL: vi.fn<() => void>(),
      })
    );
    click = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {
        /* Download is asserted without navigating jsdom. */
      });
  });
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("selects the full annual period and canonical measure, without browser source content", async () => {
    await expect(downloadInvestigatePdf(context(), {})).resolves.toStrictEqual({
      committed: true,
    });
    expect(api.observations).toHaveBeenCalledTimes(2);
    expect(api.report).toHaveBeenCalledWith(
      "08001",
      {
        template: "county-v2",
        dataset_version: "alpha-2026",
        period_start: "2023-01-01",
        period_end: "2023-12-31",
        measure_id: ["tick_survey"],
      },
      expect.objectContaining({ cache: "no-store" })
    );
    expect(api.observations).toHaveBeenCalledWith(
      expect.objectContaining({
        start_date: "2023-01-01",
        end_date: "2023-12-31",
        geography_id: ["08001"],
        page_size: 500,
      }),
      expect.objectContaining({ cache: "no-store" })
    );
    expect(click).toHaveBeenCalledOnce();
  });

  it("serializes every selected measure using the generated contract", () => {
    const url = new URL(
      getCountyReportPdfV1CountiesFipsReportPdfGetUrl("08001", {
        template: "county-v2",
        measure_id: ["tick_survey", "cases"],
        period_start: "2023-01-01",
        period_end: "2023-12-31",
        dataset_version: "alpha-2026",
      }),
      "https://example.com"
    );
    expect(url.searchParams.getAll("measure_id")).toStrictEqual([
      "tick_survey",
      "cases",
    ]);
  });

  it.each([
    "source_id",
    "lineage_source_id",
    "provenance_ref",
    "release_id",
    "methodology_version",
    "semantic_version",
    "period_end",
    "limitations",
    "value",
  ] as const)("rejects fresh %s mismatch before rendering", async (field) => {
    const original = context().observations?.[0];
    if (!original) throw new Error("Missing fixture");
    const changed = {
      ...original,
      [field]:
        field === "limitations"
          ? ["Changed caveat"]
          : field === "value"
            ? 9
            : field === "period_end"
              ? "2023-06-30"
              : "changed",
    };
    api.observations.mockResolvedValue(observationResponse([changed]));
    await expect(downloadInvestigatePdf(context(), {})).rejects.toThrow(
      "Evidence changed"
    );
    expect(api.report).not.toHaveBeenCalled();
    expect(click).not.toHaveBeenCalled();
  });

  it("rejects changed caveats during rendering instead of downloading stale evidence", async () => {
    const records = context().observations ?? [];
    api.observations
      .mockResolvedValueOnce(observationResponse(records))
      .mockResolvedValueOnce(
        observationResponse(
          records.map((item) => ({ ...item, limitations: ["Changed"] }))
        )
      );
    await expect(downloadInvestigatePdf(context(), {})).rejects.toThrow(
      "Evidence changed"
    );
    expect(api.report).toHaveBeenCalledOnce();
    expect(click).not.toHaveBeenCalled();
  });

  it("rejects pagination without using a partial or cached PDF", async () => {
    api.observations.mockResolvedValue(
      observationResponse(context().observations ?? [], "next")
    );
    await expect(downloadInvestigatePdf(context(), {})).rejects.toThrow(
      "Complete canonical evidence"
    );
    expect(api.report).not.toHaveBeenCalled();
  });

  it.each([304, 404, 422, 503] as const)(
    "does not fall back after a %s report response",
    async (status) => {
      if (status === 304)
        api.report.mockResolvedValue({
          status,
          headers: new Headers(),
          data: undefined,
        });
      else
        api.report.mockResolvedValue({
          status,
          headers: new Headers(),
          data: {
            type: "about:blank",
            title: "Request failed",
            status,
            detail: "Report unavailable",
            instance: "/report.pdf",
            request_id: "test",
          },
        });
      await expect(downloadInvestigatePdf(context(), {})).rejects.toThrow(
        "matching PDF"
      );
      expect(api.report).toHaveBeenCalledOnce();
      expect(click).not.toHaveBeenCalled();
    }
  );

  it.each([
    "empty",
    "json",
    "cacheable",
    "application/pdf+json",
    "application/pdf-error",
  ])("rejects a %s report", async (kind) => {
    const response = pdfResponse();
    if (kind === "empty") response.data = new Blob([]);
    if (kind.startsWith("application/pdf"))
      response.headers.set("content-type", kind);
    if (kind === "json")
      response.headers.set("content-type", "application/json");
    if (kind === "cacheable")
      response.headers.set("cache-control", "public, max-age=300");
    api.report.mockResolvedValue(response);
    await expect(downloadInvestigatePdf(context(), {})).rejects.toThrow(
      "matching PDF"
    );
    expect(click).not.toHaveBeenCalled();
  });

  it("accepts an exact PDF media type with optional parameters", async () => {
    const response = pdfResponse();
    response.headers.set("content-type", "Application/PDF; charset=binary");
    api.report.mockResolvedValue(response);
    await expect(downloadInvestigatePdf(context(), {})).resolves.toStrictEqual({
      committed: true,
    });
  });

  it("includes published states and leaves out measures that cannot be sent", () => {
    const base = context();
    const record = base.observations?.[0];
    if (!record) throw new Error("Missing fixture");
    const published = investigateCountyReportExportOffer({
      ...base,
      incomplete: true,
      observations: [
        record,
        {
          ...record,
          measure_id: "human_status",
          observation_id: "human",
          value: "no_county_linked_record",
          value_state: "NO_COUNTY_LINKED_RECORD",
        },
      ],
      requestedPeriod: "2024-01-01",
    });
    const missingLineage = investigateCountyReportExportOffer({
      ...base,
      observations: [{ ...record, lineage_source_id: null }],
    });
    const mixedPeriod = investigateCountyReportExportOffer({
      ...base,
      observations: [
        record,
        { ...record, observation_id: "second", period_end: "2023-06-30" },
      ],
    });
    const empty = investigateCountyReportExportOffer({
      ...base,
      observations: [],
    });
    expect({
      empty: empty.state,
      mixed: mixedPeriod.state,
      missing: missingLineage.state,
      published:
        published.state === "available"
          ? published.measureIds
          : published.state,
    }).toStrictEqual({
      empty: "unavailable",
      mixed: "unavailable",
      missing: "unavailable",
      published: ["human_status", "tick_survey"],
    });
  });

  it("lists omitted measures beside the export button", () => {
    render(
      <InvestigatePdfExport
        context={{
          ...context(),
          included: [{ label: "Tick survey", measureId: "tick_survey" }],
          omitted: [
            {
              label: "RUCC 2023",
              measureId: "rucc_2023",
              reason: "No published data for this release.",
            },
          ],
        }}
      />
    );
    expect(
      screen.getByTestId("investigate-pdf-included").textContent
    ).toContain("Tick survey");
    expect(screen.getByTestId("investigate-pdf-omitted").textContent).toContain(
      "No published data for this release."
    );
    expect(screen.getByRole("button", { name: "Export PDF" })).toBeTruthy();
  });

  it("names left-out measures when nothing can be included", () => {
    render(
      <InvestigatePdfExport
        context={{
          ...context(),
          included: [],
          observations: [],
          omitted: [
            {
              label: "RUCC 2023",
              measureId: "rucc_2023",
              reason: "No published data for this release.",
            },
          ],
        }}
      />
    );
    expect(screen.getByTestId("investigate-pdf-empty").textContent).toContain(
      "No published measure can be included"
    );
    expect(screen.getByTestId("investigate-pdf-omitted").textContent).toContain(
      "RUCC 2023"
    );
    expect(screen.queryByRole("button", { name: "Export PDF" })).toBeNull();
  });

  it("checks only the included observations before rendering", async () => {
    const base = context();
    const included = base.observations?.[0];
    if (!included) throw new Error("Missing fixture");
    const second = {
      ...included,
      measure_id: "human_status",
      observation_id: "human",
    };
    const excluded = {
      ...included,
      measure_id: "other",
      observation_id: "other",
    };
    api.observations.mockImplementation(async (params) =>
      observationResponse(
        [included, second].filter((row) => row.measure_id === params.measure_id)
      )
    );
    await expect(
      downloadInvestigatePdf(
        {
          ...base,
          included: [
            { label: "Tick survey", measureId: "tick_survey" },
            { label: "Human status", measureId: "human_status" },
          ],
          observations: [included, second, excluded],
        },
        {}
      )
    ).resolves.toStrictEqual({ committed: true });
    expect(api.report).toHaveBeenCalledWith(
      "08001",
      expect.objectContaining({
        measure_id: ["tick_survey", "human_status"],
      }),
      expect.anything()
    );
  });

  it("shows an accessible failure and allows a fresh retry", async () => {
    api.report.mockRejectedValueOnce(new Error("Renderer unavailable"));
    render(<InvestigatePdfExport context={context()} />);
    fireEvent.click(screen.getByRole("button", { name: "Export PDF" }));
    await screen.findByRole("alert");
    expect(screen.getByRole("alert").textContent).toContain(
      "Renderer unavailable"
    );
    expect(click).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Export PDF" }));
    await waitFor(() => expect(click).toHaveBeenCalledOnce());
  });

  it("discards a late report when county, release, period or caveats change", async () => {
    const deferred = Promise.withResolvers<ReturnType<typeof pdfResponse>>();
    api.report.mockReturnValue(deferred.promise);
    const view = render(<InvestigatePdfExport context={context()} />);
    fireEvent.click(screen.getByRole("button", { name: "Export PDF" }));
    await waitFor(() => expect(api.report).toHaveBeenCalledOnce());
    view.rerender(
      <InvestigatePdfExport
        context={{ ...context(), caveats: ["Updated caveat"] }}
      />
    );
    deferred.resolve(pdfResponse());
    await waitFor(() => expect(api.observations).toHaveBeenCalledTimes(2));
    expect(click).not.toHaveBeenCalled();
  });
});
