import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PdfExportButton } from "@/components/pdf-export-button";

const settings = {
  ecological_share: 65,
  low_incidence_breakpoint: 10,
  missing_human_weakness: 75,
};

describe("PDF export", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("downloads a selected county with the current governed inputs", async () => {
    const NativeURL = globalThis.URL;
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(new Blob(["%PDF-"], { type: "application/pdf" }), {
        headers: { "Content-Disposition": 'attachment; filename="adams.pdf"' },
      })
    );
    const objectUrl = vi.fn<() => string>(() => "blob:report");
    const revoke = vi.fn<(url: string) => void>();
    vi.stubGlobal("URL", {
      createObjectURL: objectUrl,
      revokeObjectURL: revoke,
    });
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {});

    render(
      <PdfExportButton
        datasetVersion="alpha-2026-08-06"
        geography={{ identifier: "08001", level: "county" }}
        settings={settings}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "Export PDF" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    const request = new NativeURL(String(fetchMock.mock.calls[0][0]));
    expect(request.pathname).toBe("/v1/counties/08001/report.pdf");
    expect(Object.fromEntries(request.searchParams)).toMatchObject({
      dataset_version: "alpha-2026-08-06",
      ecological_share: "65",
      low_incidence_breakpoint: "10",
      missing_human_weakness: "75",
    });
    expect(click).toHaveBeenCalledOnce();
    await waitFor(() => expect(revoke).toHaveBeenCalledWith("blob:report"));
  });

  it("prevents duplicate clicks and allows recovery after a failed state export", async () => {
    const deferred = Promise.withResolvers<Response>();
    vi.spyOn(globalThis, "fetch").mockReturnValue(deferred.promise);
    render(
      <PdfExportButton
        datasetVersion="alpha-2026-08-06"
        geography={{ identifier: "CO", level: "state" }}
        settings={settings}
      />
    );
    const button = screen.getByRole("button", { name: "Export PDF" });
    fireEvent.click(button);
    fireEvent.click(button);
    expect(button).toHaveProperty("disabled", true);
    deferred.reject(new Error("unavailable"));
    expect((await screen.findByRole("alert")).textContent).toContain(
      "Please try again"
    );
    expect(button).toHaveProperty("disabled", false);
  });
});
