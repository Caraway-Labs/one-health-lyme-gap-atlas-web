import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  CompareDownloadPdfsButton,
  type CompareShareCounty,
} from "@/features/ux-reset/compare/compare-share-actions";

const denver: CompareShareCounty = {
  countyName: "Denver",
  fips: "08001",
  label: "Denver, Colorado (08001)",
  stateCode: "CO",
};

const boulder: CompareShareCounty = {
  countyName: "Boulder",
  fips: "08013",
  label: "Boulder, Colorado (08013)",
  stateCode: "CO",
};

function pdfResponse(status = 200): Response {
  return new Response(new Blob(["%PDF-1.7"]), {
    headers: { "content-type": "application/pdf" },
    status,
  });
}

function installPdfFetch(
  respond: (url: string) => Promise<Response> | Response
): string[] {
  const urls: string[] = [];
  const NativeURL = globalThis.URL;
  class DownloadURL extends NativeURL {
    static createObjectURL(): string {
      return "blob:compare-pdf";
    }

    static revokeObjectURL(): void {
      return undefined;
    }
  }
  vi.spyOn(globalThis, "fetch").mockImplementation((input) => {
    const url = String(input);
    urls.push(url);
    return Promise.resolve(respond(url));
  });
  vi.stubGlobal("URL", DownloadURL);
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
  return urls;
}

describe(CompareDownloadPdfsButton, () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("stays disabled until both counties and a release are present", () => {
    render(<CompareDownloadPdfsButton counties={[denver]} releaseId="" />);
    const button = screen.getByTestId("compare-download-pdfs");
    expect({
      disabled: button.hasAttribute("disabled"),
      label: button.textContent,
      state: button.dataset.state,
    }).toStrictEqual({
      disabled: true,
      label: "Download Counties as PDF",
      state: "disabled",
    });
  });

  it("announces a busy download, then success, for both counties", async () => {
    const gate = Promise.withResolvers<boolean>();
    const urls = installPdfFetch(async () => {
      await gate.promise;
      return pdfResponse();
    });
    render(
      <CompareDownloadPdfsButton
        counties={[denver, boulder]}
        releaseId="alpha-2026"
      />
    );
    const button = screen.getByTestId("compare-download-pdfs");
    button.focus();
    fireEvent.click(button);
    await waitFor(() => {
      if (button.getAttribute("aria-busy") !== "true") {
        throw new Error("Waiting for the busy state.");
      }
    });
    const busy = button.textContent;
    gate.resolve(true);
    const status = await screen.findByText("County PDFs downloaded.");
    const paths = urls.map((url) => new URL(url, "http://localhost").pathname);
    expect({
      busy,
      keyboard:
        button.tagName === "BUTTON" && button.getAttribute("type") === "button",
      paths: paths.toSorted(),
      status: status.textContent,
    }).toStrictEqual({
      busy: "Preparing PDFs\u2026",
      keyboard: true,
      paths: ["/v1/counties/08001/report.pdf", "/v1/counties/08013/report.pdf"],
      status: "County PDFs downloaded.",
    });
  });

  it("names the county that failed and retries only that county", async () => {
    let boulderFailures = 1;
    const urls = installPdfFetch((url) => {
      if (url.includes("08013") && boulderFailures > 0) {
        boulderFailures -= 1;
        return pdfResponse(500);
      }
      return pdfResponse();
    });
    render(
      <CompareDownloadPdfsButton
        counties={[denver, boulder]}
        releaseId="alpha-2026"
      />
    );
    fireEvent.click(screen.getByTestId("compare-download-pdfs"));
    const alert = await screen.findByRole("alert");
    const beforeRetry = urls.length;
    fireEvent.click(screen.getByTestId("compare-download-pdfs"));
    await screen.findByText("County PDFs downloaded.");
    const retried = urls.slice(beforeRetry).map((url) => new URL(url).pathname);
    expect({
      alert: alert.textContent,
      retried,
    }).toStrictEqual({
      alert:
        "The PDF for Boulder, Colorado (08013) could not be downloaded. Try again. The published report was not changed.",
      retried: ["/v1/counties/08013/report.pdf"],
    });
  });
});
