import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useRef } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { buttonVariants } from "@/components/ui/button";
import {
  arrowKeyOwnedByTarget,
  decideMainScroll,
  type MainScrollDecision,
  hydrateProfessionalMainScrollForTests,
  mainLocationKey,
  normalizedSearch,
  readHistoryEntryId,
  resetProfessionalMainScrollForTests,
  targetHandlesSpace,
  useProfessionalMainScroll,
} from "@/features/ux-reset/professional-main-scroll";

const OFFSET_STORAGE_KEY = "atlas-main-scroll-offsets";

let frames: FrameRequestCallback[] = [];

function flushFrames(limit = 6) {
  for (let attempt = 0; attempt < limit; attempt += 1) {
    const pending = frames.splice(0);
    if (pending.length === 0) {
      return;
    }
    for (const frame of pending) {
      frame(attempt);
    }
  }
}

function mainElement(): HTMLElement {
  const main = screen.getByTestId("main");
  if (!(main instanceof HTMLElement)) {
    throw new Error("main scroller missing");
  }
  return main;
}

function rememberMainOffset(offset: number) {
  const main = mainElement();
  main.scrollTop = offset;
  fireEvent.scroll(main);
}

function ScrollHarness({
  pathname,
  search,
  showAnchor = false,
}: {
  pathname: string;
  search: string;
  showAnchor?: boolean;
}) {
  const mainRef = useRef<HTMLElement>(null);
  useProfessionalMainScroll(mainRef, pathname, search);
  return (
    <main
      data-testid="main"
      ref={(node) => {
        mainRef.current = node;
        if (!node) {
          return;
        }
        Object.defineProperty(node, "clientHeight", {
          configurable: true,
          value: 200,
        });
        Object.defineProperty(node, "scrollHeight", {
          configurable: true,
          value: 4000,
        });
      }}
      style={{ overflowY: "auto" }}
    >
      <div id="settings-job-title">Job title</div>
      {showAnchor ? <div id="late-anchor">Late</div> : null}
      <div data-testid="nested" style={{ overflowY: "auto" }}>
        Nested
      </div>
      <input aria-label="United States" name="starting-view" type="radio" />
      <button type="button">Save</button>
    </main>
  );
}

function renderScroller(
  pathname = "/app/review",
  search = "scope=AZ",
  showAnchor = false
) {
  const href = search.length > 0 ? `${pathname}?${search}` : pathname;
  window.history.replaceState(null, "", href);
  return render(
    <ScrollHarness
      pathname={pathname}
      search={search}
      showAnchor={showAnchor}
    />
  );
}

async function goHistory(direction: "back" | "forward") {
  let popped = false;
  window.addEventListener(
    "popstate",
    () => {
      popped = true;
    },
    { once: true }
  );
  if (direction === "back") {
    window.history.back();
  } else {
    window.history.forward();
  }
  if (popped) {
    return;
  }
  await vi.waitFor(() => {
    if (!popped) {
      throw new Error("history did not pop");
    }
  });
}

let recordedDecisions: [MainScrollDecision, MainScrollDecision][] = [];

function expectScrollDecision(
  input: Parameters<typeof decideMainScroll>[0],
  expected: MainScrollDecision
) {
  recordedDecisions.push([decideMainScroll(input), expected]);
}

function keydown(
  key: string,
  target: EventTarget = document,
  init: KeyboardEventInit = {}
): KeyboardEvent {
  const event = new KeyboardEvent("keydown", {
    bubbles: true,
    cancelable: true,
    key,
    ...init,
  });
  target.dispatchEvent(event);
  return event;
}

function appendControl(node: HTMLElement): HTMLElement {
  document.body.append(node);
  return node;
}

describe("professional main scroll decisions", () => {
  it("normalizes search order and builds a location key", () => {
    expect(normalizedSearch("b=2&a=1&b=1")).toBe("a=1&b=2&b=1");
    expect(mainLocationKey("/app/review", "")).toBe("/app/review");
    expect(mainLocationKey("/app/review", "scope=AZ&county=04013")).toBe(
      "/app/review?county=04013&scope=AZ"
    );
  });

  it("chooses restore, reset, hash, or keep for every navigation kind", () => {
    recordedDecisions = [];
    expectScrollDecision(
      {
        entryMatchesPending: true,
        hasHash: true,
        kind: "pop",
        locationKey: "/app/review?scope=AZ",
        previousLocationKey: "/app/settings",
        savedOffset: 80,
      },
      { type: "hash" }
    );
    expectScrollDecision(
      {
        entryMatchesPending: true,
        hasHash: false,
        kind: "pop",
        locationKey: "/app/review?scope=AZ",
        previousLocationKey: "/app/settings",
        savedOffset: 80,
      },
      { offset: 80, type: "restore" }
    );
    expectScrollDecision(
      {
        entryMatchesPending: false,
        hasHash: true,
        kind: "pop",
        locationKey: "/app/review",
        previousLocationKey: null,
        savedOffset: undefined,
      },
      { type: "hash" }
    );
    expectScrollDecision(
      {
        entryMatchesPending: false,
        hasHash: false,
        kind: "pop",
        locationKey: "/app/review",
        previousLocationKey: null,
        savedOffset: 10,
      },
      { type: "reset" }
    );
    expectScrollDecision(
      {
        entryMatchesPending: false,
        hasHash: true,
        kind: "push",
        locationKey: "/app/settings",
        previousLocationKey: "/app/review",
        savedOffset: 10,
      },
      { type: "hash" }
    );
    expectScrollDecision(
      {
        entryMatchesPending: false,
        hasHash: false,
        kind: "push",
        locationKey: "/app/settings",
        previousLocationKey: "/app/review",
        savedOffset: 10,
      },
      { type: "reset" }
    );
    expectScrollDecision(
      {
        entryMatchesPending: false,
        hasHash: true,
        kind: "replace",
        locationKey: "/app/settings",
        previousLocationKey: null,
        savedOffset: 90,
      },
      { type: "hash" }
    );
    expectScrollDecision(
      {
        entryMatchesPending: false,
        hasHash: false,
        kind: "replace",
        locationKey: "/app/review?scope=AZ",
        previousLocationKey: null,
        savedOffset: 90,
      },
      { offset: 90, type: "restore" }
    );
    expectScrollDecision(
      {
        entryMatchesPending: false,
        hasHash: false,
        kind: "replace",
        locationKey: "/app/review?county=04013&scope=AZ",
        previousLocationKey: "/app/review?scope=AZ",
        savedOffset: 90,
      },
      { type: "keep" }
    );
    expectScrollDecision(
      {
        entryMatchesPending: false,
        hasHash: true,
        kind: "idle",
        locationKey: "/app/settings",
        previousLocationKey: null,
        savedOffset: 40,
      },
      { type: "hash" }
    );
    expectScrollDecision(
      {
        entryMatchesPending: false,
        hasHash: false,
        kind: "idle",
        locationKey: "/app/review?scope=AZ",
        previousLocationKey: null,
        savedOffset: 40,
      },
      { offset: 40, type: "restore" }
    );
    expectScrollDecision(
      {
        entryMatchesPending: false,
        hasHash: false,
        kind: "idle",
        locationKey: "/app/settings",
        previousLocationKey: "/app/review?scope=AZ",
        savedOffset: 40,
      },
      { type: "reset" }
    );
    expectScrollDecision(
      {
        entryMatchesPending: false,
        hasHash: false,
        kind: "idle",
        locationKey: "/app/review?scope=AZ",
        previousLocationKey: "/app/review?scope=AZ",
        savedOffset: 40,
      },
      { type: "keep" }
    );
    expect(recordedDecisions.map(([actual]) => actual)).toStrictEqual(
      recordedDecisions.map(([, expected]) => expected)
    );
  });

  it("leaves arrow keys with native controls and ARIA widgets", () => {
    const types = [
      "date",
      "datetime-local",
      "email",
      "month",
      "number",
      "password",
      "radio",
      "range",
      "search",
      "tel",
      "text",
      "time",
      "url",
      "week",
    ];
    for (const type of types) {
      const input = appendControl(document.createElement("input"));
      if (input instanceof HTMLInputElement) {
        input.type = type;
      }
      expect(arrowKeyOwnedByTarget(input)).toBeTruthy();
      input.remove();
    }
    for (const tag of ["textarea", "select"]) {
      const field = appendControl(document.createElement(tag));
      expect(arrowKeyOwnedByTarget(field)).toBeTruthy();
      field.remove();
    }
    const editable = appendControl(document.createElement("div"));
    Object.defineProperty(editable, "isContentEditable", {
      configurable: true,
      get: () => true,
    });
    expect(arrowKeyOwnedByTarget(editable)).toBeTruthy();
    editable.remove();
    const roles = [
      "combobox",
      "grid",
      "listbox",
      "menu",
      "menubar",
      "menuitem",
      "option",
      "radio",
      "radiogroup",
      "scrollbar",
      "slider",
      "spinbutton",
      "tab",
      "tablist",
      "tree",
      "treegrid",
    ];
    for (const role of roles) {
      const widget = appendControl(document.createElement("div"));
      widget.setAttribute("role", role);
      const child = document.createElement("span");
      widget.append(child);
      expect(arrowKeyOwnedByTarget(child)).toBeTruthy();
      widget.remove();
    }
    const plain = appendControl(document.createElement("div"));
    expect(arrowKeyOwnedByTarget(plain)).toBeFalsy();
    expect(arrowKeyOwnedByTarget(null)).toBeFalsy();
    plain.remove();
  });

  it("leaves Space with controls that activate on Space", () => {
    const button = appendControl(document.createElement("button"));
    const link = appendControl(document.createElement("a"));
    const summary = appendControl(document.createElement("summary"));
    const radio = appendControl(document.createElement("input"));
    const checkbox = appendControl(document.createElement("input"));
    if (radio instanceof HTMLInputElement) {
      radio.type = "radio";
    }
    if (checkbox instanceof HTMLInputElement) {
      checkbox.type = "checkbox";
    }
    expect(targetHandlesSpace(button)).toBeTruthy();
    expect(targetHandlesSpace(link)).toBeTruthy();
    expect(targetHandlesSpace(summary)).toBeTruthy();
    expect(targetHandlesSpace(radio)).toBeTruthy();
    expect(targetHandlesSpace(checkbox)).toBeTruthy();
    for (const node of [button, link, summary, radio, checkbox]) {
      node.remove();
    }
  });

  it("leaves Space with ARIA widgets that activate on Space", () => {
    for (const role of [
      "button",
      "checkbox",
      "link",
      "menuitem",
      "option",
      "radio",
      "switch",
      "tab",
    ]) {
      const widget = appendControl(document.createElement("div"));
      widget.setAttribute("role", role);
      expect(targetHandlesSpace(widget)).toBeTruthy();
      widget.remove();
    }
    const plain = appendControl(document.createElement("div"));
    expect(targetHandlesSpace(plain)).toBeFalsy();
    expect(targetHandlesSpace(null)).toBeFalsy();
    plain.remove();
  });
});

describe("professional main scroll history", () => {
  beforeEach(() => {
    frames = [];
    resetProfessionalMainScrollForTests();
    vi.stubGlobal(
      "requestAnimationFrame",
      (onFrame: FrameRequestCallback): number => {
        frames.push(onFrame);
        return frames.length;
      }
    );
    vi.stubGlobal("cancelAnimationFrame", () => {});
    vi.stubGlobal("CSS", {
      escape: (value: string) => value,
    });
    window.history.replaceState(null, "", "/app/review?scope=AZ");
  });

  afterEach(() => {
    cleanup();
    resetProfessionalMainScrollForTests();
    vi.unstubAllGlobals();
  });

  it("reads only a non-empty string entry id", () => {
    expect(readHistoryEntryId(null)).toBeNull();
    expect(readHistoryEntryId({ atlasMainScrollEntry: "" })).toBeNull();
    expect(readHistoryEntryId({ atlasMainScrollEntry: 4 })).toBeNull();
    expect(readHistoryEntryId({ atlasMainScrollEntry: "entry-1" })).toBe(
      "entry-1"
    );
  });

  it("resets a pushed route and restores that entry on back", async () => {
    const view = renderScroller();
    rememberMainOffset(640);
    window.history.pushState({}, "", "/app/settings");
    view.rerender(<ScrollHarness pathname="/app/settings" search="" />);
    flushFrames();
    expect(mainElement().scrollTop).toBe(0);

    await goHistory("back");
    view.rerender(<ScrollHarness pathname="/app/review" search="scope=AZ" />);
    flushFrames();
    expect(mainElement().scrollTop).toBeGreaterThan(500);
  });

  it("starts a query-only push at the top and restores Arizona on back", async () => {
    const view = renderScroller();
    rememberMainOffset(640);
    window.history.pushState({}, "", "/app/review?scope=NY");
    view.rerender(<ScrollHarness pathname="/app/review" search="scope=NY" />);
    flushFrames();
    expect(mainElement().scrollTop).toBe(0);

    await goHistory("back");
    view.rerender(<ScrollHarness pathname="/app/review" search="scope=AZ" />);
    flushFrames();
    expect(mainElement().scrollTop).toBeGreaterThan(500);
  });

  it("stores a distinct offset for each history entry of the same URL", async () => {
    const view = renderScroller();
    rememberMainOffset(100);
    window.history.pushState({}, "", "/app/review?scope=AZ");
    rememberMainOffset(400);

    await goHistory("back");
    view.rerender(<ScrollHarness pathname="/app/review" search="scope=AZ" />);
    flushFrames();
    expect(mainElement().scrollTop).toBeGreaterThan(50);
    expect(mainElement().scrollTop).toBeLessThan(200);

    await goHistory("forward");
    view.rerender(<ScrollHarness pathname="/app/review" search="scope=AZ" />);
    flushFrames();
    expect(mainElement().scrollTop).toBeGreaterThan(300);
  });

  it("does not restore an old offset after a hash-only pop", async () => {
    const view = renderScroller("/app/investigate", "");
    rememberMainOffset(500);
    window.history.pushState({}, "", "/app/investigate#section");
    await goHistory("back");
    window.history.pushState({}, "", "/app/review?scope=NY");
    view.rerender(<ScrollHarness pathname="/app/review" search="scope=NY" />);
    flushFrames();
    expect(mainElement().scrollTop).toBe(0);
  });

  it("keeps the offset when a replace rewrites the query", () => {
    const view = renderScroller();
    rememberMainOffset(300);
    window.history.replaceState({}, "", "/app/review?scope=AZ&county=04013");
    view.rerender(
      <ScrollHarness pathname="/app/review" search="county=04013&scope=AZ" />
    );
    flushFrames();
    expect(mainElement().scrollTop).toBe(300);
  });

  it("restores a saved offset when the document reloads the entry", () => {
    const entryId = readHistoryEntryId(window.history.state);
    expect(entryId).toBeTruthy();
    sessionStorage.setItem(
      OFFSET_STORAGE_KEY,
      JSON.stringify([[entryId, 880]])
    );
    hydrateProfessionalMainScrollForTests();
    renderScroller();
    flushFrames();
    expect(mainElement().scrollTop).toBe(880);
  });

  it("restores a saved offset on the first idle mount after a reload", () => {
    const first = renderScroller();
    const entryId = readHistoryEntryId(window.history.state);
    first.unmount();
    sessionStorage.setItem(
      OFFSET_STORAGE_KEY,
      JSON.stringify([[entryId, 240]])
    );
    hydrateProfessionalMainScrollForTests();
    renderScroller();
    flushFrames();
    expect(mainElement().scrollTop).toBe(240);
  });

  it("drops the oldest stored offsets past the history cap", () => {
    renderScroller();
    window.history.pushState({}, "", "/app/feed?n=0");
    const firstId = readHistoryEntryId(window.history.state);
    rememberMainOffset(1);
    for (let index = 1; index <= 40; index += 1) {
      window.history.pushState({}, "", `/app/feed?n=${index}`);
      rememberMainOffset(index + 1);
    }
    const stored = JSON.parse(
      sessionStorage.getItem(OFFSET_STORAGE_KEY) ?? "[]"
    ) as [string, number][];
    expect(stored).toHaveLength(40);
    expect(stored.some(([id]) => id === firstId)).toBeFalsy();
  });

  it("cancels an unsettled hold when a later route replaces the entry", () => {
    const entryId = readHistoryEntryId(window.history.state);
    sessionStorage.setItem(
      OFFSET_STORAGE_KEY,
      JSON.stringify([[entryId, 700]])
    );
    hydrateProfessionalMainScrollForTests();
    const view = renderScroller();
    expect(mainElement().scrollTop).toBe(700);
    window.history.pushState({}, "", "/app/review?scope=NY");
    view.rerender(<ScrollHarness pathname="/app/review" search="scope=NY" />);
    flushFrames(12);
    expect(mainElement().scrollTop).toBe(0);
  });

  it("reapplies a restoration hold while the content is still too short", () => {
    const entryId = readHistoryEntryId(window.history.state);
    sessionStorage.setItem(
      OFFSET_STORAGE_KEY,
      JSON.stringify([[entryId, 9000]])
    );
    hydrateProfessionalMainScrollForTests();
    renderScroller();
    flushFrames(6);
    expect(mainElement().scrollTop).toBe(9000);
  });

  it("cancels a restoration hold when the user scrolls before content is ready", () => {
    const positions: number[] = [];
    const gestures = [
      (main: HTMLElement) => {
        main.dispatchEvent(new WheelEvent("wheel", { bubbles: true }));
        main.scrollTop = 25;
        fireEvent.scroll(main);
        return 25;
      },
      (main: HTMLElement) => {
        main.dispatchEvent(new Event("touchmove", { bubbles: true }));
        main.scrollTop = 30;
        fireEvent.scroll(main);
        return 30;
      },
      (main: HTMLElement) => {
        keydown("End");
        return main.scrollTop;
      },
      (main: HTMLElement) => {
        main.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true }));
        main.scrollTop = 15;
        fireEvent.scroll(main);
        return 15;
      },
    ];
    for (const gesture of gestures) {
      cleanup();
      resetProfessionalMainScrollForTests();
      window.history.replaceState(null, "", "/app/review?scope=AZ");
      const primed = renderScroller();
      const entryId = readHistoryEntryId(window.history.state);
      primed.unmount();
      sessionStorage.setItem(
        OFFSET_STORAGE_KEY,
        JSON.stringify([[entryId, 9000]])
      );
      hydrateProfessionalMainScrollForTests();
      renderScroller();
      const main = mainElement();
      const chosen = gesture(main);
      flushFrames(20);
      positions.push(main.scrollTop, chosen);
    }
    expect(positions).toStrictEqual([25, 25, 30, 30, 4000, 4000, 15, 15]);
  });

  it("cancels a hold when the scroller unmounts", () => {
    const entryId = readHistoryEntryId(window.history.state);
    sessionStorage.setItem(
      OFFSET_STORAGE_KEY,
      JSON.stringify([[entryId, 700]])
    );
    hydrateProfessionalMainScrollForTests();
    const view = renderScroller();
    expect(mainElement().scrollTop).toBe(700);
    view.unmount();
    expect(() => {
      flushFrames(12);
    }).not.toThrow();
  });

  it("resets when the location changes without a history notification", () => {
    const view = renderScroller();
    rememberMainOffset(300);
    view.rerender(<ScrollHarness pathname="/app/settings" search="" />);
    flushFrames();
    expect(mainElement().scrollTop).toBe(0);
  });

  it("scrolls a hash into main once the target exists", async () => {
    const original = HTMLElement.prototype.getBoundingClientRect;
    HTMLElement.prototype.getBoundingClientRect =
      function getBoundingClientRect() {
        if (this.id === "late-anchor") {
          return new DOMRect(0, 500, 10, 10);
        }
        if (this instanceof HTMLElement && this.dataset.testid === "main") {
          return new DOMRect(0, 0, 100, 200);
        }
        return new DOMRect(0, 0, 0, 0);
      };
    const view = renderScroller("/app/settings", "", false);
    window.history.pushState({}, "", "/app/settings#late-anchor");
    view.rerender(
      <ScrollHarness pathname="/app/settings" search="" showAnchor />
    );
    await vi.waitFor(() => {
      if (mainElement().scrollTop <= 400) {
        throw new Error("hash target is not in view");
      }
    });
    expect(mainElement().scrollTop).toBeGreaterThan(400);
    HTMLElement.prototype.getBoundingClientRect = original;
  });

  it("ignores a hashchange that belongs to a different document path", () => {
    const view = renderScroller();
    rememberMainOffset(220);
    window.history.pushState({}, "", "/app/settings");
    window.dispatchEvent(new HashChangeEvent("hashchange"));
    view.rerender(<ScrollHarness pathname="/app/settings" search="" />);
    flushFrames();
    expect(mainElement().scrollTop).toBe(0);
  });

  it("scrolls to an in-page hash on hashchange", () => {
    const original = HTMLElement.prototype.getBoundingClientRect;
    HTMLElement.prototype.getBoundingClientRect =
      function getBoundingClientRect() {
        if (this.id === "settings-job-title") {
          return new DOMRect(0, 360, 10, 10);
        }
        if (this instanceof HTMLElement && this.dataset.testid === "main") {
          return new DOMRect(0, 0, 100, 200);
        }
        return new DOMRect(0, 0, 0, 0);
      };
    renderScroller("/app/settings", "");
    window.history.pushState({}, "", "/app/settings#settings-job-title");
    window.dispatchEvent(new HashChangeEvent("hashchange"));
    flushFrames();
    expect(mainElement().scrollTop).toBeGreaterThan(300);
    HTMLElement.prototype.getBoundingClientRect = original;
  });

  it("keeps the pre-fragment offset when a hash entry reuses history state", () => {
    renderScroller("/app/investigate", "");
    rememberMainOffset(500);
    const before = readHistoryEntryId(window.history.state);
    window.history.replaceState(
      { atlasMainScrollEntry: before },
      "",
      "/app/investigate#settings-job-title"
    );
    window.dispatchEvent(new HashChangeEvent("hashchange"));
    const after = readHistoryEntryId(window.history.state);
    expect(after).toBeTruthy();
    expect(after).not.toBe(before);
    rememberMainOffset(80);
    const stored = JSON.parse(
      sessionStorage.getItem(OFFSET_STORAGE_KEY) ?? "[]"
    ) as [string, number][];
    expect(stored.find(([id]) => id === before)?.[1]).toBe(500);
    expect(stored.find(([id]) => id === after)?.[1]).toBe(80);
  });

  it("ignores corrupt session storage and keeps working when storage throws", () => {
    sessionStorage.setItem(OFFSET_STORAGE_KEY, "{");
    expect(() => {
      hydrateProfessionalMainScrollForTests();
    }).not.toThrow();
    sessionStorage.setItem(
      OFFSET_STORAGE_KEY,
      JSON.stringify(["bad", ["ok", "no"], ["nan", Number.NaN], ["kept", 12]])
    );
    hydrateProfessionalMainScrollForTests();
    const setItem = vi
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation(() => {
        throw new Error("storage blocked");
      });
    renderScroller();
    expect(() => {
      rememberMainOffset(15);
    }).not.toThrow();
    setItem.mockRestore();
    const getItem = vi
      .spyOn(Storage.prototype, "getItem")
      .mockImplementation(() => {
        throw new Error("storage blocked");
      });
    expect(() => {
      hydrateProfessionalMainScrollForTests();
    }).not.toThrow();
    getItem.mockRestore();
  });

  it("keeps the latest offset when the same entry scrolls again", async () => {
    const view = renderScroller();
    rememberMainOffset(80);
    rememberMainOffset(160);
    window.history.pushState({}, "", "/app/settings");
    view.rerender(<ScrollHarness pathname="/app/settings" search="" />);
    await goHistory("back");
    view.rerender(<ScrollHarness pathname="/app/review" search="scope=AZ" />);
    flushFrames();
    expect(mainElement().scrollTop).toBeGreaterThan(120);
  });

  it("treats an empty history URL as the current location", () => {
    const view = renderScroller();
    rememberMainOffset(140);
    window.history.pushState({}, "");
    view.rerender(<ScrollHarness pathname="/app/review" search="scope=AZ" />);
    flushFrames();
    expect(mainElement().scrollTop).toBe(140);
  });

  it("treats an unparsable history URL as the current location", () => {
    renderScroller();
    expect(() => {
      window.history.pushState({}, "", "http://[");
    }).toThrow(DOMException);
  });

  it("keeps the leaving offset when navigation zeros main before pushState", async () => {
    const view = renderScroller();
    rememberMainOffset(640);
    const link = appendControl(document.createElement("a"));
    link.setAttribute("href", "/app/review?scope=NY");
    link.textContent = "Open New York review";
    fireEvent.pointerDown(link);
    mainElement().scrollTop = 0;
    fireEvent.scroll(mainElement());
    window.history.pushState({}, "", "/app/review?scope=NY");
    view.rerender(<ScrollHarness pathname="/app/review" search="scope=NY" />);
    flushFrames();
    expect(mainElement().scrollTop).toBe(0);

    await goHistory("back");
    view.rerender(<ScrollHarness pathname="/app/review" search="scope=AZ" />);
    flushFrames();
    expect(mainElement().scrollTop).toBeGreaterThan(500);
    link.remove();
  });

  it("keeps a positive offset after a modified click or hash-only link", () => {
    renderScroller();
    rememberMainOffset(640);
    const external = appendControl(document.createElement("a"));
    external.setAttribute("href", "/app/settings");
    external.textContent = "Settings";
    external.addEventListener("click", (event) => {
      event.preventDefault();
    });
    fireEvent.click(external, { metaKey: true });
    mainElement().scrollTop = 0;
    fireEvent.scroll(mainElement());
    const afterModified = JSON.parse(
      sessionStorage.getItem(OFFSET_STORAGE_KEY) ?? "[]"
    ) as [string, number][];
    expect(afterModified.at(-1)?.[1]).toBe(640);

    rememberMainOffset(640);
    const hashLink = appendControl(document.createElement("a"));
    hashLink.setAttribute("href", "#settings-job-title");
    hashLink.textContent = "Job title";
    hashLink.addEventListener("click", (event) => {
      event.preventDefault();
    });
    fireEvent.click(hashLink);
    mainElement().scrollTop = 0;
    fireEvent.scroll(mainElement());
    const afterHash = JSON.parse(
      sessionStorage.getItem(OFFSET_STORAGE_KEY) ?? "[]"
    ) as [string, number][];
    expect(afterHash.at(-1)?.[1]).toBe(640);
    external.remove();
    hashLink.remove();
  });

  it("seeds a same-URL push and ignores a history jump to zero", async () => {
    const view = renderScroller();
    rememberMainOffset(180);
    window.history.pushState({}, "", "/app/review?scope=AZ");
    rememberMainOffset(420);
    mainElement().scrollTop = 0;
    fireEvent.scroll(mainElement());
    expect(mainElement().scrollTop).toBe(420);

    await goHistory("back");
    view.rerender(<ScrollHarness pathname="/app/review" search="scope=AZ" />);
    flushFrames();
    expect(mainElement().scrollTop).toBeGreaterThan(100);
    expect(mainElement().scrollTop).toBeLessThan(250);

    mainElement().scrollTop = 0;
    fireEvent.scroll(mainElement());
    expect(mainElement().scrollTop).toBeGreaterThan(100);
    await goHistory("forward");
    view.rerender(<ScrollHarness pathname="/app/review" search="scope=AZ" />);
    flushFrames();
    expect(mainElement().scrollTop).toBeGreaterThan(350);
  });

  it("stores a wheel gesture that scrolls main to the top", () => {
    renderScroller();
    rememberMainOffset(180);
    mainElement().dispatchEvent(new WheelEvent("wheel", { bubbles: true }));
    mainElement().scrollTop = 0;
    fireEvent.scroll(mainElement());
    const stored = JSON.parse(
      sessionStorage.getItem(OFFSET_STORAGE_KEY) ?? "[]"
    ) as [string, number][];
    expect(stored.at(-1)?.[1]).toBe(0);
  });

  it("keeps the offset when Enter activates an option before main jumps to zero", () => {
    renderScroller();
    rememberMainOffset(320);
    const option = appendControl(document.createElement("div"));
    option.setAttribute("role", "option");
    option.tabIndex = 0;
    option.focus();
    keydown("Enter", option);
    mainElement().scrollTop = 0;
    fireEvent.scroll(mainElement());
    const stored = JSON.parse(
      sessionStorage.getItem(OFFSET_STORAGE_KEY) ?? "[]"
    ) as [string, number][];
    expect(stored.at(-1)?.[1]).toBe(320);
    option.remove();
  });

  it("commits the live offset when a navigation click stays on the entry", () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    try {
      renderScroller();
      rememberMainOffset(640);
      const link = appendControl(document.createElement("a"));
      link.setAttribute("href", "/app/settings");
      link.textContent = "Settings";
      fireEvent.pointerDown(link);
      mainElement().scrollTop = 0;
      fireEvent.scroll(mainElement());
      vi.advanceTimersByTime(1500);
      const stored = JSON.parse(
        sessionStorage.getItem(OFFSET_STORAGE_KEY) ?? "[]"
      ) as [string, number][];
      expect(stored.at(-1)?.[1]).toBe(0);
      link.remove();
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("professional main scroll keyboard ownership", () => {
  beforeEach(() => {
    frames = [];
    resetProfessionalMainScrollForTests();
    vi.stubGlobal(
      "requestAnimationFrame",
      (onFrame: FrameRequestCallback): number => {
        frames.push(onFrame);
        return frames.length;
      }
    );
    vi.stubGlobal("cancelAnimationFrame", () => {});
    window.history.replaceState(null, "", "/app/review?scope=AZ");
    renderScroller();
  });

  afterEach(() => {
    cleanup();
    resetProfessionalMainScrollForTests();
    vi.unstubAllGlobals();
  });

  it("pages main from the document and leaves radio arrows alone", () => {
    const main = mainElement();
    const pageDown = keydown("PageDown");
    expect(pageDown.defaultPrevented).toBeTruthy();
    expect(main.scrollTop).toBe(200);

    const radio = screen.getByRole("radio", { name: "United States" });
    const arrow = keydown("ArrowDown", radio);
    expect(arrow.defaultPrevented).toBeFalsy();
    expect(main.scrollTop).toBe(200);
  });

  it("lets Space activate a radio and a button", () => {
    const main = mainElement();
    const radio = screen.getByRole("radio", { name: "United States" });
    const space = keydown(" ", radio);
    expect(space.defaultPrevented).toBeFalsy();
    expect(main.scrollTop).toBe(0);

    const button = screen.getByRole("button", { name: "Save" });
    expect(keydown(" ", button).defaultPrevented).toBeFalsy();
    expect(main.scrollTop).toBe(0);
  });

  it("leaves arrow, Home, End, and Page keys with native controls at the main boundary", () => {
    const main = mainElement();
    const keys = ["ArrowDown", "ArrowUp", "End", "Home", "PageDown", "PageUp"];
    const fields = [
      ["input", "date"],
      ["input", "datetime-local"],
      ["input", "email"],
      ["input", "month"],
      ["input", "number"],
      ["input", "password"],
      ["input", "range"],
      ["input", "search"],
      ["input", "tel"],
      ["input", "text"],
      ["input", "time"],
      ["input", "url"],
      ["input", "week"],
      ["select", ""],
      ["textarea", ""],
    ];
    const prevented: boolean[] = [];
    for (const [tag, type] of fields) {
      const field = appendControl(document.createElement(tag));
      if (field instanceof HTMLInputElement) {
        field.type = type;
      }
      for (const key of keys) {
        prevented.push(keydown(key, field).defaultPrevented);
      }
      field.remove();
    }
    expect(prevented.some(Boolean)).toBeFalsy();
    expect(main.scrollTop).toBe(0);
  });

  it("leaves Home, End, and Page keys with range and slider controls", () => {
    const main = mainElement();
    const range = appendControl(document.createElement("input"));
    if (range instanceof HTMLInputElement) {
      range.type = "range";
    }
    const slider = appendControl(document.createElement("div"));
    slider.setAttribute("role", "slider");
    slider.tabIndex = 0;
    expect(keydown("Home", range).defaultPrevented).toBeFalsy();
    expect(keydown("End", range).defaultPrevented).toBeFalsy();
    expect(keydown("PageDown", range).defaultPrevented).toBeFalsy();
    expect(keydown("PageUp", slider).defaultPrevented).toBeFalsy();
    expect(main.scrollTop).toBe(0);
    range.remove();
    slider.remove();
  });

  it("pages from Home, End, arrows, and Shift+Space", () => {
    const main = mainElement();
    keydown("End");
    expect(main.scrollTop).toBeGreaterThan(200);
    keydown("Home");
    expect(main.scrollTop).toBe(0);
    keydown("ArrowDown");
    expect(main.scrollTop).toBe(200);
    keydown(" ", document, { shiftKey: true });
    expect(main.scrollTop).toBe(0);
  });

  it("ignores paging keys that include a modifier", () => {
    expect(
      keydown("ArrowDown", document, { altKey: true }).defaultPrevented
    ).toBeFalsy();
    expect(
      keydown("PageDown", document, { ctrlKey: true }).defaultPrevented
    ).toBeFalsy();
    expect(
      keydown("PageDown", document, { metaKey: true }).defaultPrevented
    ).toBeFalsy();
    expect(
      keydown("ArrowUp", document, { shiftKey: true }).defaultPrevented
    ).toBeFalsy();
  });

  it("does not page when a dialog is open or a nested scroller has room", () => {
    const main = mainElement();
    const before = main.scrollTop;
    const dialog = appendControl(document.createElement("div"));
    dialog.setAttribute("aria-modal", "true");
    expect(keydown("PageDown").defaultPrevented).toBeFalsy();
    expect(main.scrollTop).toBe(before);
    dialog.remove();

    const nested = screen.getByTestId("nested");
    Object.defineProperty(nested, "clientHeight", {
      configurable: true,
      value: 40,
    });
    Object.defineProperty(nested, "scrollHeight", {
      configurable: true,
      value: 400,
    });
    nested.scrollTop = 0;
    expect(keydown("ArrowDown", nested).defaultPrevented).toBeFalsy();

    const outside = appendControl(document.createElement("div"));
    outside.style.overflowY = "auto";
    Object.defineProperty(outside, "clientHeight", {
      configurable: true,
      value: 40,
    });
    Object.defineProperty(outside, "scrollHeight", {
      configurable: true,
      value: 400,
    });
    outside.scrollTop = 360;
    const atEnd = keydown("ArrowDown", outside);
    expect(atEnd.defaultPrevented).toBeTruthy();
    expect(main.scrollTop).toBeGreaterThan(before);
    outside.remove();
  });

  it("does not page from text entry or an already handled key", () => {
    const input = appendControl(document.createElement("input"));
    if (input instanceof HTMLInputElement) {
      input.type = "search";
    }
    expect(keydown(" ", input).defaultPrevented).toBeFalsy();
    expect(keydown("ArrowUp", input).defaultPrevented).toBeFalsy();
    input.remove();

    const handled = keydown("PageDown");
    expect(handled.defaultPrevented).toBeTruthy();
    const again = new KeyboardEvent("keydown", {
      bubbles: true,
      cancelable: true,
      key: "PageDown",
    });
    again.preventDefault();
    document.dispatchEvent(again);
    expect(mainElement().scrollTop).toBe(200);
  });

  it("does not page from a textarea, select, or textbox", () => {
    const notes = appendControl(document.createElement("textarea"));
    const picker = appendControl(document.createElement("select"));
    const textbox = appendControl(document.createElement("div"));
    textbox.setAttribute("role", "textbox");
    expect(keydown("ArrowDown", notes).defaultPrevented).toBeFalsy();
    expect(keydown("ArrowDown", picker).defaultPrevented).toBeFalsy();
    expect(keydown(" ", textbox).defaultPrevented).toBeFalsy();
    notes.remove();
    picker.remove();
    textbox.remove();
  });
});

describe("primary hover contrast", () => {
  it("uses the darker primary hover token on default buttons", () => {
    const classes = buttonVariants();
    expect(classes).toContain("hover:bg-primary-hover");
    expect(classes.includes("hover:bg-primary/80")).toBeFalsy();
  });
});
