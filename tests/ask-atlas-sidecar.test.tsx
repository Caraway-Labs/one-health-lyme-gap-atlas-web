import { cleanup, render, screen } from "@testing-library/react";
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
import {
  inheritedContextFromReview,
  type AskAtlasInheritedContext,
} from "@/features/ux-reset/ask-atlas/inherited-context";
import { readAskAtlasPageReference } from "@/features/ux-reset/ask-atlas/page-reference";

let pathname = "/app/explore";
let search = new URLSearchParams();

vi.mock(import("next/navigation"), async (importOriginal) => ({
  ...(await importOriginal()),
  usePathname: () => pathname,
  useSearchParams: () => search as unknown as ReadonlyURLSearchParams,
}));

const { chatRequest } = vi.hoisted(() => ({
  chatRequest: vi.fn<(...args: unknown[]) => Promise<unknown>>(),
}));

vi.mock(import("../src/generated/atlas"), async (importOriginal) => ({
  ...(await importOriginal()),
  knowledgeGraphChatV1KnowledgeGraphChatPost: chatRequest as never,
}));

function ChromeProbe() {
  const chrome = useAskAtlasChrome();
  return <div data-testid="launcher-slot">{chrome.launcher}</div>;
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

function launcherHref(): URL {
  return new URL(
    screen.getByTestId("ask-atlas-launcher").getAttribute("href") ?? "",
    "http://localhost"
  );
}

describe("Ask Atlas dedicated-page launcher", () => {
  beforeEach(() => {
    pathname = "/app/explore";
    search = new URLSearchParams();
    chatRequest.mockReset();
    vi.stubEnv("NEXT_PUBLIC_KG_CHAT_ENABLED", "true");
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllEnvs();
  });

  it("links to Ask Atlas without a panel when the page has no validated context", () => {
    pathname = "/app/action";
    render(
      <AskAtlasChromeProvider>
        <ChromeProbe />
      </AskAtlasChromeProvider>
    );
    const href = launcherHref();
    expect({
      dialog: screen.queryByRole("dialog"),
      panel: screen.queryByTestId("ask-atlas-panel"),
      pathname: href.pathname,
      reference: readAskAtlasPageReference(href.pathname, href.searchParams)
        .kind,
    }).toStrictEqual({
      dialog: null,
      panel: null,
      pathname: "/app/assistant",
      reference: "absent",
    });
    expect(chatRequest).not.toHaveBeenCalled();
  });

  it("keeps settings free of a second assistant", () => {
    pathname = "/app/settings";
    render(
      <AskAtlasChromeProvider>
        <ChromeProbe />
      </AskAtlasChromeProvider>
    );
    expect(screen.queryByTestId("ask-atlas-launcher")).toBeNull();
    expect(screen.queryByTestId("ask-atlas-panel")).toBeNull();
  });

  it("still links to the page when literature chat is disabled", () => {
    vi.stubEnv("NEXT_PUBLIC_KG_CHAT_ENABLED", "false");
    render(
      <AskAtlasChromeProvider>
        <ChromeProbe />
      </AskAtlasChromeProvider>
    );
    expect(launcherHref().pathname).toBe("/app/assistant");
    expect(screen.queryByLabelText("Your question")).toBeNull();
    expect(screen.queryByTestId("ask-atlas-panel")).toBeNull();
    expect(chatRequest).not.toHaveBeenCalled();
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

  it("puts the published review identity on the Ask Atlas link", () => {
    pathname = "/app/review";
    search = new URLSearchParams("scope=CO&county=08001&dataset=alpha-2026");
    const review = inheritedContextFromReview({
      rankedCounties: [
        { county: "Adams", fips: "08001", state_name: "Colorado" },
      ],
      releaseId: "alpha-2026",
      releaseReady: true,
      requestedCounty: "08001",
    });
    render(
      <AskAtlasChromeProvider>
        <Publisher value={review} />
        <ChromeProbe />
      </AskAtlasChromeProvider>
    );
    const href = launcherHref();
    const state = readAskAtlasPageReference(href.pathname, href.searchParams);
    const geography =
      state.kind === "validated"
        ? state.reference.context.fields.geography
        : null;
    expect({
      geography,
      kind: state.kind,
      panel: screen.queryByTestId("ask-atlas-panel"),
      returnHref: state.kind === "validated" ? state.returnHref : null,
    }).toStrictEqual({
      geography: {
        id: "08001",
        label: "Adams, Colorado (08001)",
        state: "validated",
      },
      kind: "validated",
      panel: null,
      returnHref: "/app/review?scope=CO&county=08001&dataset=alpha-2026",
    });
  });
});
