import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AtlasApiError } from "@/lib/api-mutator";

const {
  confirmPrivacyRequest,
  createPrivacyRequest,
  downloadPrivacyExport,
  push,
  signOut,
} = vi.hoisted(() => ({
  createPrivacyRequest: vi.fn<() => Promise<unknown>>(),
  confirmPrivacyRequest: vi.fn<() => Promise<unknown>>(),
  downloadPrivacyExport: vi.fn<() => Promise<unknown>>(),
  push: vi.fn<(href: string) => void>(),
  signOut: vi.fn<() => Promise<void>>(),
}));

vi.mock(
  import("next/navigation"),
  () =>
    ({
      useRouter: () => ({ push }),
    }) as unknown as Partial<typeof import("next/navigation")>
);
vi.mock(import("../src/lib/supabase/client"), () => ({
  createClient: () => ({
    auth: { signOut },
  }),
}));
vi.mock(
  import("../src/generated/atlas"),
  () =>
    ({
      createPrivacyRequestV1MePrivacyRequestsPost: createPrivacyRequest,
      confirmPrivacyRequestV1MePrivacyRequestsRequestIdConfirmPost:
        confirmPrivacyRequest,
      downloadPrivacyExportV1MePrivacyRequestsRequestIdExportGet:
        downloadPrivacyExport,
    }) as unknown as Partial<typeof import("../src/generated/atlas")>
);

import { AccountDataRights } from "../src/components/account-data-rights";

describe("account data rights", () => {
  beforeEach(() => {
    createPrivacyRequest.mockResolvedValue({
      status: 200,
      data: {
        request_id: "req-export-1",
        confirmation_nonce: "nonce-abcdefghijklmnopqrstuvwxyz",
        state: "requested",
      },
    });
    confirmPrivacyRequest.mockResolvedValue({
      status: 200,
      data: {
        request_id: "req-export-1",
        state: "completed",
        download_available: true,
      },
    });
    downloadPrivacyExport.mockResolvedValue({
      status: 200,
      data: {
        schema_version: "atlas-user-data-export/v1",
        omissions: [{ processor: "analytics", reason: "not_linked" }],
      },
    });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it("names stores, timing, omissions, and the support path before export", () => {
    render(<AccountDataRights />);
    fireEvent.click(screen.getByRole("button", { name: "Export my data" }));

    const dialog = screen.getByRole("dialog", { name: "Export my data?" });
    expect(dialog.textContent).toMatch(
      /Saved workspaces[\s\S]*in-product feedback[\s\S]*unlinked Amplitude sessions[\s\S]*30 days[\s\S]*Public Atlas datasets are unaffected[\s\S]*support status and a request reference/
    );
  });

  it("downloads the completed export after confirmation", async () => {
    const objectUrl = vi.fn<() => string>(() => "blob:export");
    const revoke = vi.fn<(url: string) => void>();
    vi.stubGlobal("URL", {
      createObjectURL: objectUrl,
      revokeObjectURL: revoke,
    });
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

    render(<AccountDataRights />);
    fireEvent.click(screen.getByRole("button", { name: "Export my data" }));
    fireEvent.click(
      screen.getAllByRole("button", { name: "Export my data" }).at(-1)!
    );

    await waitFor(() => {
      expect(screen.getByRole("status").textContent).toContain(
        "Your data export downloaded."
      );
    });
    expect(createPrivacyRequest).toHaveBeenCalledWith({ action: "export" });
    expect(confirmPrivacyRequest).toHaveBeenCalledWith("req-export-1", {
      nonce: "nonce-abcdefghijklmnopqrstuvwxyz",
    });
    expect(downloadPrivacyExport).toHaveBeenCalledWith("req-export-1");
    expect(objectUrl).toHaveBeenCalledOnce();
  });

  it("closes the confirmation dialog with Escape without starting a request", () => {
    render(<AccountDataRights />);
    fireEvent.click(screen.getByRole("button", { name: "Remove all data" }));
    expect(
      screen.getByRole("dialog", { name: "Remove all data?" }).textContent
    ).toMatch(/cannot be undone/);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(createPrivacyRequest).not.toHaveBeenCalled();
  });

  it("recovers from a failed request with a live status and request reference", async () => {
    createPrivacyRequest.mockRejectedValueOnce(
      new AtlasApiError(
        "rate limited",
        "/v1/me/privacy-requests",
        429,
        "req-log-9"
      )
    );

    render(<AccountDataRights />);
    fireEvent.click(screen.getByRole("button", { name: "Export my data" }));
    fireEvent.click(
      screen.getAllByRole("button", { name: "Export my data" }).at(-1)!
    );

    await waitFor(() => {
      expect(screen.getByRole("status").textContent).toContain(
        "We could not complete that privacy request."
      );
    });
    expect(screen.getByRole("status").textContent).toContain(
      "Reference: req-log-9."
    );
  });

  it("sends a stale session back to sign-in instead of deleting", async () => {
    createPrivacyRequest.mockRejectedValueOnce(
      new AtlasApiError("stale", "/v1/me/privacy-requests", 401, null)
    );

    render(<AccountDataRights />);
    fireEvent.click(screen.getByRole("button", { name: "Remove all data" }));
    fireEvent.click(
      screen.getAllByRole("button", { name: "Remove all data" }).at(-1)!
    );

    await waitFor(() => {
      expect(push).toHaveBeenCalledWith("/auth/sign-in?next=%2Faccount");
    });
    expect(signOut).not.toHaveBeenCalled();
  });
});
