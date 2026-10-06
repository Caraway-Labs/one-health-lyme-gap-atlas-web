import { cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import {
  resetExploreUrlNavigationGuardForTests,
  useExploreUrlNavigationGuard,
} from "@/features/ux-reset/explore/explore-url-navigation-guard";

const NUQS_HISTORY_MARKER = "__nuqs__";
const originalReplaceState = history.replaceState.bind(history);
const originalPushState = history.pushState.bind(history);

function locationHref(): string {
  return `${window.location.pathname}${window.location.search}`;
}

function nuqsReplace(pathAndSearch: string): void {
  window.history.replaceState(
    null,
    NUQS_HISTORY_MARKER,
    new URL(pathAndSearch, window.location.origin).href
  );
}

function activateLeavingLink(href: string): void {
  const link = document.createElement("a");
  link.href = href;
  link.textContent = "Leave Explore";
  link.addEventListener("click", (event) => {
    event.preventDefault();
  });
  document.body.append(link);
  link.click();
}

describe("Explore URL navigation guard", () => {
  afterEach(async () => {
    cleanup();
    resetExploreUrlNavigationGuardForTests();
    window.history.replaceState = originalReplaceState;
    window.history.pushState = originalPushState;
    originalReplaceState(null, "", "/");
    document.body.replaceChildren();
    await Promise.resolve();
  });

  it("still applies an Explore replace before cross-route navigation starts", async () => {
    renderHook(() => useExploreUrlNavigationGuard());
    await Promise.resolve();
    originalReplaceState(null, "", "/app/explore?scope=CO&county=08001");

    nuqsReplace("/app/explore?scope=CO&county=08001&metric=precipitation-mm");

    expect(locationHref()).toBe(
      "/app/explore?scope=CO&county=08001&metric=precipitation-mm"
    );
  });

  it("drops a queued nuqs replace that would rewrite the destination", async () => {
    renderHook(() => useExploreUrlNavigationGuard());
    await Promise.resolve();
    originalReplaceState(null, "", "/app/explore?scope=CO&county=08001");

    const applied: string[] = [];
    const replaceBeforeClick = window.history.replaceState.bind(window.history);
    window.history.replaceState = (data, unused, url) => {
      applied.push(String(url ?? ""));
      replaceBeforeClick(data, "", url);
    };

    activateLeavingLink("/app/investigate?scope=CO&county=08001");
    nuqsReplace("/app/explore?scope=CO&county=08001&metric=precipitation-mm");
    window.history.pushState(
      null,
      "",
      "/app/investigate?scope=CO&county=08001"
    );
    nuqsReplace(
      "/app/investigate?scope=CO&county=08001&metric=precipitation-mm"
    );

    expect({ applied, href: locationHref() }).toStrictEqual({
      applied: [],
      href: "/app/investigate?scope=CO&county=08001",
    });
  });

  it("does not block nuqs writes after Back or Forward leaves Explore", async () => {
    const view = renderHook(() => useExploreUrlNavigationGuard());
    await Promise.resolve();
    originalReplaceState(null, "", "/app/explore?county=08001");
    originalPushState(null, "", "/app/investigate?county=08001");
    window.dispatchEvent(new PopStateEvent("popstate"));
    nuqsReplace("/app/investigate?county=08001&metric=precipitation-mm");
    const whileMounted = locationHref();

    view.unmount();
    await Promise.resolve();
    originalReplaceState(null, "", "/app/review?scope=CO");
    window.dispatchEvent(new PopStateEvent("popstate"));
    nuqsReplace("/app/review?scope=CO&county=08001");

    expect({ afterLeave: locationHref(), whileMounted }).toStrictEqual({
      afterLeave: "/app/review?scope=CO&county=08001",
      whileMounted: "/app/investigate?county=08001",
    });
  });

  it("allows the next page to write after Explore unmounts", async () => {
    const view = renderHook(() => useExploreUrlNavigationGuard());
    await Promise.resolve();
    originalReplaceState(null, "", "/app/explore?county=08001");
    activateLeavingLink("/app/investigate?county=08001");
    window.history.pushState(null, "", "/app/investigate?county=08001");
    view.unmount();

    nuqsReplace("/app/investigate?county=08001&metric=precipitation-mm");
    const duringUnmount = locationHref();
    await Promise.resolve();
    nuqsReplace("/app/investigate?county=08001&period=2023");

    expect({ afterUnmount: locationHref(), duringUnmount }).toStrictEqual({
      afterUnmount: "/app/investigate?county=08001&period=2023",
      duringUnmount: "/app/investigate?county=08001",
    });
  });
});
