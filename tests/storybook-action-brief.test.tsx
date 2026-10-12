import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  EVIDENCE_BRIEF_CATALOG_WITHHELD,
  EVIDENCE_BRIEF_LOCAL_CONTEXT_INVALID,
  EVIDENCE_BRIEF_NOT_LOADED,
  EVIDENCE_BRIEF_OBSERVATIONS_ABSENT,
  EVIDENCE_BRIEF_OBSERVATIONS_FAILED,
  EVIDENCE_BRIEF_UNRESOLVED,
} from "@/features/ux-reset/action/evidence-brief";
import { ActionEvidenceBrief } from "@/features/ux-reset/action/evidence-brief-panel";
import { downloadInvestigatePdf } from "@/features/ux-reset/investigate/download-investigate-pdf";
import type { InvestigatePdfContext } from "@/features/ux-reset/investigate/investigate-next-step";
import type { PdfDownloadOptions, PdfDownloadResult } from "@/lib/pdf-export";

import { ActionEvidenceBriefStory } from "../stories/action-evidence-brief.stories";
import {
  actionBriefPreset,
  SYNTHETIC_LOCAL_NOTE,
  SYNTHETIC_RELEASE_LIMITATION,
  syntheticLocalNoteOverLimit,
} from "../stories/fixtures/action-brief-presets";
import {
  isLower48OrDcFips,
  syntheticCounty,
  syntheticReleaseId,
} from "../stories/fixtures/synthetic-county";
import {
  downloadInvestigatePdf as substituteDownload,
  setSyntheticPdfExportMode,
  SYNTHETIC_PDF_EXPORT_FAILURE,
} from "../stories/support/download-investigate-pdf-substitute";

vi.mock(
  import("@/features/ux-reset/investigate/download-investigate-pdf"),
  () => ({
    downloadInvestigatePdf:
      vi.fn<
        (
          context: InvestigatePdfContext,
          options: PdfDownloadOptions
        ) => Promise<PdfDownloadResult>
      >(),
  })
);

const CASES_FINDING =
  "Reported Lyme cases: 12 cases. Available. Period 2023. Source CDC surveillance.";
const EMPTY_LIMITATION =
  "No material limitation was returned on the observations for this county.";
const CASES_STAMP =
  "County 08001. Release alpha-2026. Periods 2023. Sources CDC surveillance.";

const download = vi.mocked(downloadInvestigatePdf);

function renderPreset(id: Parameters<typeof actionBriefPreset>[0]) {
  const model = actionBriefPreset(id);
  render(
    <ActionEvidenceBrief
      catalogFailed={model.catalogFailed}
      countyRecord={model.countyRecord}
      countyRecordError={model.countyRecordError}
      countyRecordLoading={model.countyRecordLoading}
      localContext={model.localContext}
      measures={model.measures}
      observationOutcome={model.observationOutcome}
      onLocalContextChange={() => {}}
      period={model.period}
      realBundle={model.realBundle}
      recovery={model.recovery}
    />
  );
  return model;
}

describe("Action evidence brief stories", () => {
  afterEach(() => {
    cleanup();
    download.mockReset();
    setSyntheticPdfExportMode("succeed");
  });

  it("keeps the synthetic county in the lower 48 on release alpha-2026", () => {
    const ready = actionBriefPreset("ready");
    expect({
      fips: ready.realBundle?.county.fips,
      lower48: isLower48OrDcFips(syntheticCounty.fips),
      name: ready.realBundle?.county.label,
      release: ready.realBundle?.releaseId,
      state: syntheticCounty.stateFips,
    }).toStrictEqual({
      fips: "08001",
      lower48: true,
      name: "Adams County",
      release: syntheticReleaseId,
      state: "08",
    });
  });

  it("renders the ready brief without putting the local note in governed evidence", () => {
    renderPreset("ready");
    const governed = screen.getByTestId("action-brief-governed").textContent;
    const exported = screen.getByTestId(
      "investigate-export-context"
    ).textContent;
    expect({
      exportState: screen.getByTestId("investigate-export-context").dataset
        .exportState,
      finding: screen.getByTestId("action-brief-finding").textContent,
      governedHasNote: governed?.includes(SYNTHETIC_LOCAL_NOTE),
      limitation: screen.getByTestId("action-brief-limitation").textContent,
      note: (
        screen.getByTestId("action-brief-local-context") as HTMLTextAreaElement
      ).value,
      pdfHasNote: exported?.includes(SYNTHETIC_LOCAL_NOTE),
      stamp: screen.getByTestId("action-brief-stamp").textContent,
    }).toStrictEqual({
      exportState: "available",
      finding: CASES_FINDING,
      governedHasNote: false,
      limitation: EMPTY_LIMITATION,
      note: SYNTHETIC_LOCAL_NOTE,
      pdfHasNote: false,
      stamp: CASES_STAMP,
    });
  });

  it("shows the governed release limitation and keeps the case finding", () => {
    renderPreset("governed-limitation");
    expect({
      finding: screen.getByTestId("action-brief-finding").textContent,
      limitation: screen.getByTestId("action-brief-limitation").textContent,
      stamp: screen.getByTestId("action-brief-stamp").textContent,
    }).toStrictEqual({
      finding: CASES_FINDING,
      limitation: SYNTHETIC_RELEASE_LIMITATION,
      stamp: CASES_STAMP,
    });
  });

  it("blocks catalog, request, absence, loading, and recovery before the brief", () => {
    const expected = [
      ["blocked-catalog", "catalog_withheld", EVIDENCE_BRIEF_CATALOG_WITHHELD],
      [
        "blocked-failed",
        "observations_failed",
        EVIDENCE_BRIEF_OBSERVATIONS_FAILED,
      ],
      [
        "blocked-absent",
        "observations_absent",
        EVIDENCE_BRIEF_OBSERVATIONS_ABSENT,
      ],
      ["blocked-not-loaded", "observations_loading", EVIDENCE_BRIEF_NOT_LOADED],
      ["recovery", "unresolved_county", EVIDENCE_BRIEF_UNRESOLVED],
    ] as const;
    const rendered = expected.map(([id]) => {
      cleanup();
      renderPreset(id);
      return {
        blocker: screen.getByTestId("action-brief-blocker").textContent,
        export: screen.queryByRole("button", { name: "Export PDF" }),
        state: screen.getByTestId("action-evidence-brief").dataset.state,
        textarea: screen.queryByTestId("action-brief-local-context"),
      };
    });
    expect(rendered).toStrictEqual(
      expected.map(([, state, blocker]) => ({
        blocker,
        export: null,
        state,
        textarea: null,
      }))
    );
  });

  it("marks a local note past 1,000 characters invalid", () => {
    renderPreset("over-limit");
    const field = screen.getByTestId(
      "action-brief-local-context"
    ) as HTMLTextAreaElement;
    expect({
      alert: screen.getByRole("alert").textContent,
      finding: screen.getByTestId("action-brief-finding").textContent,
      invalid: field.getAttribute("aria-invalid"),
      tooLong: field.value.length > 1000,
      value: field.value,
    }).toStrictEqual({
      alert: EVIDENCE_BRIEF_LOCAL_CONTEXT_INVALID,
      finding: CASES_FINDING,
      invalid: "true",
      tooLong: true,
      value: syntheticLocalNoteOverLimit,
    });
  });

  it("calls the download boundary with the governed county and not the local note", async () => {
    download.mockResolvedValue({ committed: false });
    render(<ActionEvidenceBriefStory exportMode="succeed" preset="ready" />);
    fireEvent.change(screen.getByTestId("action-brief-local-context"), {
      target: { value: `${SYNTHETIC_LOCAL_NOTE} LOCAL-NOTE-9F3C` },
    });
    fireEvent.click(screen.getByRole("button", { name: "Export PDF" }));
    await waitFor(() => {
      expect(download).toHaveBeenCalledOnce();
    });
    expect(download).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        countyFips: syntheticCounty.fips,
        releaseId: syntheticReleaseId,
      }),
      expect.objectContaining({ shouldCommit: expect.any(Function) })
    );
    expect(JSON.stringify(download.mock.calls[0]?.[0])).not.toContain(
      "LOCAL-NOTE-9F3C"
    );
  });

  it("clears a failed export and restores the preset note on reset", async () => {
    download.mockRejectedValue(new Error(SYNTHETIC_PDF_EXPORT_FAILURE));
    render(<ActionEvidenceBriefStory exportMode="fail" preset="ready" />);
    fireEvent.change(screen.getByTestId("action-brief-local-context"), {
      target: { value: "LOCAL-NOTE-9F3C" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Export PDF" }));
    await screen.findByRole("heading", { name: "The PDF did not download" });
    fireEvent.click(screen.getByTestId("action-brief-reset"));
    const field = screen.getByTestId(
      "action-brief-local-context"
    ) as HTMLTextAreaElement;
    expect({
      error: screen.queryByRole("heading", {
        name: "The PDF did not download",
      }),
      value: field.value,
    }).toStrictEqual({
      error: null,
      value: SYNTHETIC_LOCAL_NOTE,
    });
  });

  it("keeps the PDF substitute from saving a file", async () => {
    const context: InvestigatePdfContext = {
      caveats: [],
      countyFips: syntheticCounty.fips,
      periods: ["2023"],
      releaseId: syntheticReleaseId,
      requestedPeriod: "2023",
      sources: ["CDC surveillance"],
    };
    setSyntheticPdfExportMode("succeed");
    const succeeded = await substituteDownload(context, {});
    setSyntheticPdfExportMode("fail");
    const failed = substituteDownload(context, {});
    const controller = new AbortController();
    setSyntheticPdfExportMode("pending");
    const pending = substituteDownload(context, { signal: controller.signal });
    controller.abort();
    await expect(failed).rejects.toThrow(SYNTHETIC_PDF_EXPORT_FAILURE);
    await expect(pending).rejects.toMatchObject({ name: "AbortError" });
    expect(succeeded).toStrictEqual({ committed: false });
  });
});
