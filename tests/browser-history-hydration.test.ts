import { afterEach, describe, expect, it } from "vitest";

import {
  installBrowserHistoryHydrationGuard,
  markBrowserHistoryHydrationReady,
  resetBrowserHistoryHydrationGuardForTests,
} from "@/lib/browser-history-hydration";

const ACTION_HREF =
  "http://localhost:3000/app/action?county=08001&dataset=alpha-2026-08-06";
const INVESTIGATE_HREF =
  "http://localhost:3000/app/investigate?county=08001&dataset=alpha-2026-08-06";

describe("browser history hydration guard", () => {
  afterEach(() => {
    resetBrowserHistoryHydrationGuardForTests();
  });

  it("reloads the history entry when hydration replaceState undoes Back", () => {
    window.history.replaceState(null, "", ACTION_HREF);
    const reloads: string[] = [];
    installBrowserHistoryHydrationGuard(ACTION_HREF, (href) => {
      reloads.push(href);
    });
    window.history.pushState(null, "", INVESTIGATE_HREF);
    window.dispatchEvent(new PopStateEvent("popstate"));

    window.history.replaceState({ __NA: true }, "", ACTION_HREF);

    expect(reloads).toStrictEqual([INVESTIGATE_HREF]);
    expect(window.location.pathname).toBe("/app/investigate");
  });

  it("lets Next update history after the router listener is ready", () => {
    window.history.replaceState(null, "", ACTION_HREF);
    const reloads: string[] = [];
    installBrowserHistoryHydrationGuard(ACTION_HREF, (href) => {
      reloads.push(href);
    });
    markBrowserHistoryHydrationReady();
    window.history.pushState(null, "", INVESTIGATE_HREF);
    window.dispatchEvent(new PopStateEvent("popstate"));

    window.history.replaceState({ __NA: true }, "", INVESTIGATE_HREF);

    expect(reloads).toStrictEqual([]);
    expect(window.location.pathname).toBe("/app/investigate");
  });

  it("still applies a same-page replace while hydration is in progress", () => {
    window.history.replaceState(null, "", ACTION_HREF);
    const reloads: string[] = [];
    installBrowserHistoryHydrationGuard(ACTION_HREF, (href) => {
      reloads.push(href);
    });

    window.history.replaceState(null, "", `${ACTION_HREF}&period=2023-01-01`);

    expect(reloads).toStrictEqual([]);
    expect(window.location.search).toContain("period=2023-01-01");
  });
});
