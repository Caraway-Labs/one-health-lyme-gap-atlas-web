import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { DownloadCountyPdfButton } from "@/features/ux-reset/review/download-county-pdf-button";
import {
  atlasBriefFilename,
  downloadPdfReport,
  governedCountyReportScoreSettings,
} from "@/lib/pdf-export";

const releaseId = "governed-2026-10-15-january-climate-prod";
const governed = governedCountyReportScoreSettings();

function pdfResponse(options?: {
  body?: string;
  contentDisposition?: string | null;
  contentType?: string;
  status?: number;
}) {
  const headers = new Headers({
    "content-type": options?.contentType ?? "application/pdf",
  });
  if (options?.contentDisposition) {
    headers.set("content-disposition", options.contentDisposition);
  }
  return new Response(new Blob([options?.body ?? "%PDF-1.7"]), {
    headers,
    status: options?.status ?? 200,
  });
}

describe("county PDF download", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("builds the approved county and state filename", () => {
    expect({
      apostrophe: atlasBriefFilename("Prince George's County", "MD"),
      blank: atlasBriefFilename("  ", "IA"),
      district: atlasBriefFilename("District of Columbia", "DC"),
      saint: atlasBriefFilename("St. Louis County", "MO"),
      stateName: atlasBriefFilename("Worth", "Iowa"),
      worth: atlasBriefFilename("Worth County", "ia"),
    }).toStrictEqual({
      apostrophe: "Prince_George_s_MD_AtlasBrief.pdf",
      blank: null,
      district: "District_of_Columbia_DC_AtlasBrief.pdf",
      saint: "St_Louis_MO_AtlasBrief.pdf",
      stateName: null,
      worth: "Worth_IA_AtlasBrief.pdf",
    });
  });

  it("keeps a disabled Download PDF action when no county is selected", () => {
    render(
      <DownloadCountyPdfButton
        countyName=""
        fips=""
        releaseId=""
        stateCode=""
      />
    );
    const button = screen.getByRole("button", { name: "Download PDF" });
    expect(button).toHaveProperty("disabled", true);
    expect(button.dataset.state).toBe("disabled");
    expect(
      screen.getByText("Choose a county to download its PDF.")
    ).toBeTruthy();
  });

  it("downloads the published report and prefers an approved server filename", async () => {
    const NativeURL = globalThis.URL;
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      pdfResponse({
        contentDisposition: 'attachment; filename="Worth_IA_AtlasBrief.pdf"',
      })
    );
    vi.stubGlobal("URL", {
      createObjectURL: () => "blob:worth",
      revokeObjectURL: vi.fn<(url: string) => void>(),
    });
    let savedName = "";
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(function capture(this: HTMLAnchorElement) {
        savedName = this.download;
      });

    render(
      <DownloadCountyPdfButton
        countyName="Worth County"
        fips="19195"
        releaseId={releaseId}
        stateCode="IA"
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "Download PDF" }));
    await waitFor(() => expect(click).toHaveBeenCalledOnce());
    const request = new NativeURL(String(fetchMock.mock.calls[0]?.[0]));
    expect({
      dataset: request.searchParams.get("dataset_version"),
      download: savedName,
      eco: request.searchParams.get("eco"),
      ecological: request.searchParams.get("ecological_share"),
      pathname: request.pathname,
      template: request.searchParams.get("template"),
    }).toStrictEqual({
      dataset: releaseId,
      download: "Worth_IA_AtlasBrief.pdf",
      eco: null,
      ecological: String(governed.ecological_share),
      pathname: "/v1/counties/19195/report.pdf",
      template: null,
    });
    expect({
      breakpoint: request.searchParams.get("low_incidence_breakpoint"),
      weakness: request.searchParams.get("missing_human_weakness"),
    }).toStrictEqual({
      breakpoint: String(governed.low_incidence_breakpoint),
      weakness: String(governed.missing_human_weakness),
    });
  });

  it("replaces a server filename that does not match the approved pattern", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      pdfResponse({
        contentDisposition:
          'attachment; filename="lyme-gap-atlas-ia-worth-county-19195-governed-2026-10-15-january-climate-prod.pdf"',
      })
    );
    vi.stubGlobal("URL", {
      createObjectURL: () => "blob:worth",
      revokeObjectURL: vi.fn<(url: string) => void>(),
    });
    let savedName = "";
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(
      function capture(this: HTMLAnchorElement) {
        savedName = this.download;
      }
    );
    render(
      <DownloadCountyPdfButton
        countyName="Worth County"
        fips="19195"
        releaseId={releaseId}
        stateCode="IA"
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "Download PDF" }));
    await waitFor(() => expect(savedName).toBe("Worth_IA_AtlasBrief.pdf"));
  });

  it("does not save a non-PDF response and can be tried again", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      pdfResponse({ contentType: "application/pdf+json" })
    );
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {});
    render(
      <DownloadCountyPdfButton
        countyName="Worth County"
        fips="19195"
        releaseId={releaseId}
        stateCode="IA"
      />
    );
    const button = screen.getByRole("button", { name: "Download PDF" });
    fireEvent.click(button);
    expect((await screen.findByRole("alert")).textContent).toContain(
      "Try again"
    );
    expect(click).not.toHaveBeenCalled();
    expect(button).toHaveProperty("disabled", false);
  });

  it("drops a late file after the selected county changes", async () => {
    const pending = Promise.withResolvers<Response>();
    vi.spyOn(globalThis, "fetch").mockImplementation((_input, init) => {
      const abort = () => {
        pending.reject(
          new DOMException("The operation was aborted.", "AbortError")
        );
      };
      if (init?.signal?.aborted) {
        abort();
      } else {
        init?.signal?.addEventListener("abort", abort, { once: true });
      }
      return pending.promise;
    });
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {});
    const view = render(
      <DownloadCountyPdfButton
        countyName="Worth County"
        fips="19195"
        releaseId={releaseId}
        stateCode="IA"
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "Download PDF" }));
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Downloading PDF…" })
      ).toBeTruthy()
    );
    view.rerender(
      <DownloadCountyPdfButton
        countyName="Polk County"
        fips="19153"
        releaseId={releaseId}
        stateCode="IA"
      />
    );
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Download PDF" })
      ).toHaveProperty("disabled", false)
    );
    expect(click).not.toHaveBeenCalled();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("does not save an unexpected media type from the shared client", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      pdfResponse({ contentType: "application/pdf-error" })
    );
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {});
    await expect(
      downloadPdfReport(
        { identifier: "19195", level: "county" },
        governed,
        releaseId
      )
    ).rejects.toThrow(/unexpected type/);
    expect(click).not.toHaveBeenCalled();
  });
});
