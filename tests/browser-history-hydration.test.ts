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

  it("reloads a same-route query traversal that happens before the router listener", () => {
    const boulder =
      "http://localhost:3000/explore?county=08013&dataset=alpha-2026&period=2023-01-01&scope=CO";
    const denver =
      "http://localhost:3000/explore?county=08001&dataset=alpha-2026&period=2023-01-01&scope=CO";
    window.history.replaceState(null, "", boulder);
    const reloads: string[] = [];
    installBrowserHistoryHydrationGuard(boulder, (href) => {
      reloads.push(href);
    });
    window.history.pushState(null, "", denver);
    window.dispatchEvent(new PopStateEvent("popstate"));

    window.history.replaceState({ __NA: true }, "", boulder);

    expect(reloads).toStrictEqual([denver]);
    expect(window.location.search).toContain("county=08001");
  });

  it("recovers a query traversal that finished before the guard was installed", () => {
    const boulder =
      "http://localhost:3000/explore?county=08013&dataset=alpha-2026&period=2023-01-01&scope=CO";
    const denver =
      "http://localhost:3000/explore?county=08001&dataset=alpha-2026&period=2023-01-01&scope=CO";
    window.history.replaceState(null, "", denver);
    const reloads: string[] = [];
    installBrowserHistoryHydrationGuard(boulder, (href) => {
      reloads.push(href);
    });

    window.history.replaceState({ __NA: true }, "", boulder);

    expect(reloads).toStrictEqual([denver]);
    expect(window.location.href).toBe(denver);
  });

  it("does not reload a popstate that stays on the loaded document", () => {
    window.history.replaceState(null, "", ACTION_HREF);
    const reloads: string[] = [];
    installBrowserHistoryHydrationGuard(ACTION_HREF, (href) => {
      reloads.push(href);
    });

    window.dispatchEvent(new PopStateEvent("popstate"));

    expect(reloads).toStrictEqual([]);
    expect(window.location.href).toBe(ACTION_HREF);
  });
});
