import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReadonlyURLSearchParams } from "next/navigation";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  AskAtlasChromeProvider,
  useAskAtlasChrome,
} from "@/features/ux-reset/ask-atlas/ask-atlas-chrome";
import {
  AskAtlasInheritedContextProvider,
  useAskAtlasInheritedContext,
  usePublishAskAtlasInheritedContext,
} from "@/features/ux-reset/ask-atlas/ask-atlas-context";
import { inheritedContextFromReview } from "@/features/ux-reset/ask-atlas/inherited-context";
import type { AskAtlasInheritedContext } from "@/features/ux-reset/ask-atlas/inherited-context";

let pathname = "/app/explore";

vi.mock(import("next/navigation"), async (importOriginal) => ({
  ...(await importOriginal()),
  usePathname: () => pathname,
  useSearchParams: () => new URLSearchParams() as ReadonlyURLSearchParams,
}));

const { chatRequest } = vi.hoisted(() => ({
  chatRequest: vi.fn<(...args: unknown[]) => Promise<unknown>>(),
}));

vi.mock(import("../src/generated/atlas"), async (importOriginal) => ({
  ...(await importOriginal()),
  knowledgeGraphChatV1KnowledgeGraphChatPost: chatRequest as never,
}));

function stubMatchMedia(mobile: boolean) {
  vi.stubGlobal(
    "matchMedia",
    (query: string): MediaQueryList =>
      ({
        addEventListener: () => {},
        dispatchEvent: () => true,
        matches: query.includes("800px") ? mobile : false,
        media: query,
        onchange: null,
        removeEventListener: () => {},
      }) as unknown as MediaQueryList
  );
}

function ChromeProbe() {
  const chrome = useAskAtlasChrome();
  return (
    <div>
      <div data-testid="launcher-slot">{chrome.launcher}</div>
      <div data-testid="desktop-slot">{chrome.desktopPanel}</div>
      <div data-page-inert={chrome.pageInert ? "true" : "false"} />
      <div data-testid="modal-slot">{chrome.compactModal}</div>
    </div>
  );
}

function ContextProbe() {
  const context = useAskAtlasInheritedContext();
  return (
    <p data-testid="published-release">
      {context?.fields.release.state === "validated"
        ? context.fields.release.id
        : "none"}
    </p>
  );
}

function Publisher({ value }: { value: AskAtlasInheritedContext | null }) {
  usePublishAskAtlasInheritedContext(value);
  return null;
}

describe("Ask Atlas reset sidecar", () => {
  beforeEach(() => {
    pathname = "/app/explore";
    localStorage.clear();
    chatRequest.mockReset();
    stubMatchMedia(false);
    vi.stubEnv("NEXT_PUBLIC_KG_CHAT_ENABLED", "true");
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("keeps Action and other non-analytical routes free of a second assistant", () => {
    pathname = "/app/action";
    render(
      <AskAtlasChromeProvider>
        <ChromeProbe />
      </AskAtlasChromeProvider>
    );
    expect(screen.queryByRole("button", { name: "Ask Atlas" })).toBeNull();
    expect(screen.queryByTestId("ask-atlas-panel")).toBeNull();
  });

  it("shows the disabled backend fixture and does not call the request adapter", () => {
    vi.stubEnv("NEXT_PUBLIC_KG_CHAT_ENABLED", "false");
    render(
      <AskAtlasChromeProvider>
        <ChromeProbe />
      </AskAtlasChromeProvider>
    );
    fireEvent.click(screen.getByRole("button", { name: "Ask Atlas" }));
    expect(screen.getByTestId("ask-atlas-disabled").textContent).toContain(
      "service availability state"
    );
    expect(screen.queryByLabelText("Your question")).toBeNull();
    expect(chatRequest).not.toHaveBeenCalled();
    expect(
      screen.getByTestId("desktop-slot").querySelector("#ux-reset-ask-atlas")
    ).toBeTruthy();
    expect(
      document.querySelector<HTMLElement>("[data-page-inert]")?.dataset
        .pageInert
    ).toBe("false");
  });

  it("uses a modal inert flag only while the compact sidecar is open", () => {
    stubMatchMedia(true);
    render(
      <AskAtlasChromeProvider>
        <ChromeProbe />
      </AskAtlasChromeProvider>
    );
    expect(
      document.querySelector<HTMLElement>("[data-page-inert]")?.dataset
        .pageInert
    ).toBe("false");
    fireEvent.click(screen.getByRole("button", { name: "Ask Atlas" }));
    expect({
      dialog: Boolean(
        screen.queryByRole("dialog", { name: "Atlas Assistant" })
      ),
      dock: screen
        .getByTestId("desktop-slot")
        .querySelector("#ux-reset-ask-atlas"),
      inert:
        document.querySelector<HTMLElement>("[data-page-inert]")?.dataset
          .pageInert,
      modal: Boolean(
        screen.getByTestId("modal-slot").querySelector("#ux-reset-ask-atlas")
      ),
    }).toStrictEqual({
      dialog: true,
      dock: null,
      inert: "true",
      modal: true,
    });
    fireEvent.click(screen.getByRole("button", { name: "Close Ask Atlas" }));
    expect(screen.queryByTestId("ask-atlas-panel")).toBeNull();
    expect(
      document.querySelector<HTMLElement>("[data-page-inert]")?.dataset
        .pageInert
    ).toBe("false");
  });

  it("clears inherited context when the publishing page unmounts", () => {
    const review = inheritedContextFromReview({
      rankedCounties: [
        { county: "Adams", fips: "08001", state_name: "Colorado" },
      ],
      releaseId: "alpha-2026",
      releaseReady: true,
      requestedCounty: "08001",
    });
    const { rerender } = render(
      <AskAtlasInheritedContextProvider>
        <Publisher value={review} />
        <ContextProbe />
      </AskAtlasInheritedContextProvider>
    );
    expect(screen.getByTestId("published-release").textContent).toBe(
      "alpha-2026"
    );
    rerender(
      <AskAtlasInheritedContextProvider>
        <ContextProbe />
      </AskAtlasInheritedContextProvider>
    );
    expect(screen.getByTestId("published-release").textContent).toBe("none");
  });
});
