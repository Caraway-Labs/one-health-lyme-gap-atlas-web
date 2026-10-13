import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import type { ReadonlyURLSearchParams } from "next/navigation";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import ResetWorkspaceOverviewPage from "@/app/app/page";
import {
  escapeStillClosingNavigation,
  mobileTriggerRestoreShouldStop,
  trustedMobileTriggerRestoreShouldStop,
} from "@/features/ux-reset/mobile-trigger-restore";
import * as mobileTriggerRestore from "@/features/ux-reset/mobile-trigger-restore";
import { RESET_APP_PATH } from "@/features/ux-reset/paths";
import { ResetProfessionalShell } from "@/features/ux-reset/professional-shell";

let pathname = RESET_APP_PATH;
let searchParams = new URLSearchParams();

vi.mock(import("next/navigation"), async (importOriginal) => ({
  ...(await importOriginal()),
  usePathname: () => pathname,
  useSearchParams: () => searchParams as ReadonlyURLSearchParams,
}));

function createResponsiveMatchMedia(initialMobile: boolean) {
  let isMobile = initialMobile;
  const listeners = new Set<() => void>();
  vi.stubGlobal(
    "matchMedia",
    (query: string): MediaQueryList =>
      ({
        addEventListener: (_type: string, listener: () => void) => {
          listeners.add(listener);
        },
        dispatchEvent: () => true,
        get matches() {
          return query.includes("800px") ? isMobile : false;
        },
        media: query,
        onchange: null,
        removeEventListener: (_type: string, listener: () => void) => {
          listeners.delete(listener);
        },
      }) as unknown as MediaQueryList
  );
  return {
    setMobile(next: boolean) {
      isMobile = next;
      for (const listener of listeners) {
        listener();
      }
    },
  };
}

function mockMobileViewport(matches: boolean) {
  createResponsiveMatchMedia(matches);
}

describe("UX Reset shell accessibility", () => {
  beforeEach(() => {
    pathname = RESET_APP_PATH;
    searchParams = new URLSearchParams();
    mockMobileViewport(false);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("keeps accessible names on collapsed sidebar links", () => {
    render(
      <ResetProfessionalShell>
        <ResetWorkspaceOverviewPage />
      </ResetProfessionalShell>
    );

    fireEvent.click(screen.getByRole("button", { name: "Hide navigation" }));
    const navigation = screen.getByRole("navigation", {
      name: "Professional workspace",
    });
    expect(
      navigation.querySelector('a[href="/explore"]')?.getAttribute("aria-label")
    ).toBe("Atlas Explorer");
    expect(navigation.querySelector('a[href="/overview"]')).toBeNull();
    expect(
      screen.queryByRole("link", { name: "Open legacy Atlas" })
    ).toBeNull();
  });

  it("marks the mobile drawer inert while closed so links are not tabbable", async () => {
    mockMobileViewport(true);
    render(
      <ResetProfessionalShell>
        <ResetWorkspaceOverviewPage />
      </ResetProfessionalShell>
    );

    const sidebar = document.querySelector("#ux-reset-pro-navigation");
    await waitFor(() => {
      expect(sidebar?.hasAttribute("inert")).toBeTruthy();
    });

    fireEvent.keyDown(document.body, { key: "Tab" });
    expect(sidebar?.contains(document.activeElement)).toBeFalsy();
  });

  it("traps focus in the open mobile drawer and restores focus on close", async () => {
    mockMobileViewport(true);
    render(
      <ResetProfessionalShell>
        <ResetWorkspaceOverviewPage />
      </ResetProfessionalShell>
    );

    const openButton = screen.getByRole("button", { name: "Open navigation" });
    openButton.focus();
    fireEvent.click(openButton);

    const sidebar = document.querySelector("#ux-reset-pro-navigation");
    await waitFor(() => {
      expect(sidebar?.hasAttribute("inert")).toBeFalsy();
    });
    await waitFor(() => {
      expect(document.activeElement?.getAttribute("aria-label")).toBe(
        "Close navigation"
      );
    });

    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => {
      expect(sidebar?.hasAttribute("inert")).toBeTruthy();
    });
    expect(document.activeElement).toBe(openButton);
  });

  it("reclaims Close navigation when focus drops to the body after opening", async () => {
    mockMobileViewport(true);
    render(
      <ResetProfessionalShell>
        <ResetWorkspaceOverviewPage />
      </ResetProfessionalShell>
    );

    const openButton = screen.getByRole("button", { name: "Open navigation" });
    openButton.focus();
    fireEvent.click(openButton);
    const closeButton = screen.getByRole("button", {
      name: "Close navigation",
    });
    await waitFor(() => {
      expect(document.activeElement).toBe(closeButton);
    });

    closeButton.blur();
    await waitFor(() => {
      expect(document.activeElement).toBe(closeButton);
    });

    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => {
      expect(
        document
          .querySelector("#ux-reset-pro-navigation")
          ?.hasAttribute("inert")
      ).toBeTruthy();
    });
    expect(document.activeElement).toBe(openButton);
  });

  it("reclaims Open navigation when closing moves focus to the body", async () => {
    const frames: FrameRequestCallback[] = [];
    vi.stubGlobal(
      "requestAnimationFrame",
      (onFrame: FrameRequestCallback): number => {
        frames.push(onFrame);
        return frames.length;
      }
    );
    vi.stubGlobal("cancelAnimationFrame", () => {});
    mockMobileViewport(true);
    render(
      <ResetProfessionalShell>
        <ResetWorkspaceOverviewPage />
      </ResetProfessionalShell>
    );

    const openButton = screen.getByRole("button", { name: "Open navigation" });
    openButton.focus();
    fireEvent.click(openButton);
    const staleOpenReclaim = frames.at(-1);
    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => {
      expect(
        document
          .querySelector("#ux-reset-pro-navigation")
          ?.hasAttribute("inert")
      ).toBeTruthy();
    });
    staleOpenReclaim?.(0);
    expect(document.activeElement).toBe(openButton);
    openButton.blur();
    expect(document.activeElement).not.toBe(openButton);
    frames.at(-1)?.(0);
    expect(document.activeElement).toBe(openButton);
  });

  it("reclaims Open navigation when focus moves to the body after the frame budget", async () => {
    mockMobileViewport(true);
    render(
      <ResetProfessionalShell>
        <ResetWorkspaceOverviewPage />
      </ResetProfessionalShell>
    );

    const openButton = screen.getByRole("button", { name: "Open navigation" });
    openButton.focus();
    fireEvent.click(openButton);
    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => {
      expect(
        document
          .querySelector("#ux-reset-pro-navigation")
          ?.hasAttribute("inert")
      ).toBeTruthy();
    });
    expect(document.activeElement).toBe(openButton);

    const elsewhere = document.createElement("button");
    elsewhere.type = "button";
    elsewhere.textContent = "Elsewhere";
    document.body.append(elsewhere);
    elsewhere.focus();
    expect(document.activeElement).toBe(elsewhere);
    await vi.waitUntil(() => document.activeElement === openButton, {
      interval: 16,
      timeout: 400,
    });
    elsewhere.remove();
  });

  it("stops restoring the mobile trigger for Tab, Shift+Tab, Escape, and an outside pointer", () => {
    const trigger = document.createElement("button");
    const outside = document.createElement("button");
    document.body.append(trigger, outside);
    const dispatched = (
      type: "keydown" | "pointerdown",
      target: HTMLElement,
      init: KeyboardEventInit = {}
    ) => {
      const event =
        type === "keydown"
          ? new KeyboardEvent(type, {
              bubbles: true,
              cancelable: true,
              ...init,
            })
          : new MouseEvent(type, { bubbles: true, cancelable: true });
      target.dispatchEvent(event);
      return event;
    };
    expect(
      mobileTriggerRestoreShouldStop(
        dispatched("keydown", trigger, { key: "Tab" }),
        trigger
      )
    ).toBeTruthy();
    expect(
      mobileTriggerRestoreShouldStop(
        dispatched("keydown", trigger, { key: "Tab", shiftKey: true }),
        trigger
      )
    ).toBeTruthy();
    expect(
      mobileTriggerRestoreShouldStop(
        dispatched("keydown", trigger, { key: "Escape" }),
        trigger
      )
    ).toBeTruthy();
    expect(
      mobileTriggerRestoreShouldStop(
        dispatched("keydown", trigger, { key: "Enter" }),
        trigger
      )
    ).toBeFalsy();
    expect(
      mobileTriggerRestoreShouldStop(
        dispatched("pointerdown", outside),
        trigger
      )
    ).toBeTruthy();
    trigger.remove();
    outside.remove();
  });

  it("keeps restoring through the Escape press that closed the drawer", () => {
    const closing = new KeyboardEvent("keydown", { key: "Escape" });
    const repeat = new KeyboardEvent("keydown", {
      key: "Escape",
      repeat: true,
    });
    const later = new KeyboardEvent("keydown", { key: "Escape" });
    const tab = new KeyboardEvent("keydown", { key: "Tab" });
    expect(
      escapeStillClosingNavigation(closing, closing.timeStamp + 5)
    ).toBeTruthy();
    expect(
      escapeStillClosingNavigation(repeat, repeat.timeStamp - 5)
    ).toBeTruthy();
    expect(
      escapeStillClosingNavigation(later, later.timeStamp - 5)
    ).toBeFalsy();
    expect(escapeStillClosingNavigation(tab, tab.timeStamp + 5)).toBeFalsy();
  });

  it("keeps restoring for Space or a pointer on the trigger, and ignores untrusted leaves", () => {
    const trigger = document.createElement("button");
    const outside = document.createElement("button");
    document.body.append(trigger, outside);
    const dispatched = (
      type: "keydown" | "pointerdown",
      target: HTMLElement,
      init: KeyboardEventInit = {}
    ) => {
      const event =
        type === "keydown"
          ? new KeyboardEvent(type, {
              bubbles: true,
              cancelable: true,
              ...init,
            })
          : new MouseEvent(type, { bubbles: true, cancelable: true });
      target.dispatchEvent(event);
      return event;
    };
    expect(
      mobileTriggerRestoreShouldStop(
        dispatched("keydown", trigger, { key: " " }),
        trigger
      )
    ).toBeFalsy();
    expect(
      mobileTriggerRestoreShouldStop(
        dispatched("pointerdown", trigger),
        trigger
      )
    ).toBeFalsy();
    expect(
      trustedMobileTriggerRestoreShouldStop(
        dispatched("keydown", trigger, { key: "Tab" }),
        trigger
      )
    ).toBeFalsy();
    expect(
      trustedMobileTriggerRestoreShouldStop(
        dispatched("pointerdown", outside),
        trigger
      )
    ).toBeFalsy();
    expect(
      mobileTriggerRestoreShouldStop(
        dispatched("keydown", outside, { key: "ArrowDown" }),
        trigger
      )
    ).toBeTruthy();
    trigger.remove();
    outside.remove();
  });

  it("does not pull focus back after Tab leaves Open navigation", async () => {
    const leave = vi
      .spyOn(mobileTriggerRestore, "trustedMobileTriggerRestoreShouldStop")
      .mockImplementation((event, trigger) =>
        mobileTriggerRestore.mobileTriggerRestoreShouldStop(event, trigger)
      );
    try {
      mockMobileViewport(true);
      render(
        <ResetProfessionalShell>
          <ResetWorkspaceOverviewPage />
        </ResetProfessionalShell>
      );

      const openButton = screen.getByRole("button", {
        name: "Open navigation",
      });
      openButton.focus();
      fireEvent.click(openButton);
      fireEvent.keyDown(document, { key: "Escape" });
      await waitFor(() => {
        expect(
          document
            .querySelector("#ux-reset-pro-navigation")
            ?.hasAttribute("inert")
        ).toBeTruthy();
      });
      expect(document.activeElement).toBe(openButton);

      const next = document.createElement("button");
      next.type = "button";
      next.textContent = "Next control";
      document.body.append(next);
      openButton.dispatchEvent(
        new KeyboardEvent("keydown", {
          bubbles: true,
          cancelable: true,
          key: "Tab",
        })
      );
      next.focus();
      const started = performance.now();
      await vi.waitUntil(
        () =>
          performance.now() - started >= 350 && document.activeElement === next,
        { interval: 20, timeout: 800 }
      );
      expect(document.activeElement).toBe(next);
      next.remove();
    } finally {
      leave.mockRestore();
    }
  });

  it("clears mobile modal state when the viewport grows past the drawer breakpoint", async () => {
    const viewport = createResponsiveMatchMedia(true);
    render(
      <ResetProfessionalShell>
        <ResetWorkspaceOverviewPage />
      </ResetProfessionalShell>
    );

    fireEvent.click(screen.getByRole("button", { name: "Open navigation" }));
    const sidebar = document.querySelector("#ux-reset-pro-navigation");
    const inset = document.querySelector(".app-inset");
    await waitFor(() => {
      expect(sidebar?.getAttribute("role")).toBe("dialog");
      expect(inset?.hasAttribute("inert")).toBeTruthy();
    });

    viewport.setMobile(false);
    await waitFor(() => {
      expect(sidebar?.getAttribute("role")).toBeNull();
      expect(inset?.hasAttribute("inert")).toBeFalsy();
      expect(sidebar?.hasAttribute("aria-modal")).toBeFalsy();
    });
  });
});
