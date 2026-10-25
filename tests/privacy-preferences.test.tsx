import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { PrivacyPreferences } from "@/components/privacy-preferences";
import { ANALYTICS_PREFERENCE_KEY } from "@/lib/analytics-consent";

function storedDecision(): string | undefined {
  const raw = localStorage.getItem(ANALYTICS_PREFERENCE_KEY);
  if (!raw) {
    return undefined;
  }
  const preference = JSON.parse(raw) as { decision?: string };
  return preference.decision;
}

function withDoNotTrack(value: string | null, run: () => void) {
  const descriptor = Object.getOwnPropertyDescriptor(navigator, "doNotTrack");
  Object.defineProperty(navigator, "doNotTrack", {
    configurable: true,
    get: () => value,
  });
  try {
    run();
  } finally {
    if (descriptor) {
      Object.defineProperty(navigator, "doNotTrack", descriptor);
    } else {
      Reflect.deleteProperty(navigator, "doNotTrack");
    }
  }
}

describe(PrivacyPreferences, () => {
  afterEach(() => {
    cleanup();
    localStorage.clear();
  });

  it("allows, withdraws, and reloads the same browser preference from Settings", () => {
    const view = render(<PrivacyPreferences presentation="section" />);
    expect(screen.getByRole("status").textContent).toBe(
      "Optional analytics are on for this browser until you turn them off."
    );
    const allow = screen.getByRole("button", {
      name: "Allow optional analytics",
    });
    const decline = screen.getByRole("button", {
      name: "Turn off optional analytics",
    });

    fireEvent.click(allow);
    expect({
      decision: storedDecision(),
      status: screen.getByRole("status").textContent,
    }).toStrictEqual({
      decision: "granted",
      status: expect.stringContaining("Optional analytics are allowed"),
    });

    fireEvent.click(decline);
    expect({
      decision: storedDecision(),
      status: screen.getByRole("status").textContent,
    }).toStrictEqual({
      decision: "denied",
      status: "Optional analytics are off for this browser.",
    });

    view.unmount();
    render(<PrivacyPreferences presentation="section" />);
    expect(screen.getByRole("status").textContent).toBe(
      "Optional analytics are off for this browser."
    );
    expect(storedDecision()).toBe("denied");
  });

  it("keeps a declined choice in the public dialog and can allow it later", () => {
    render(<PrivacyPreferences />);
    fireEvent.click(screen.getByRole("button", { name: "Privacy settings" }));
    expect(
      screen.getByText(
        "Product analytics are on by default on public Atlas pages and in the signed-in professional workspace. Turn them off here at any time. If your browser sends Do Not Track, Atlas keeps them off. Atlas works the same either way."
      )
    ).toBeTruthy();
    fireEvent.click(
      screen.getByRole("button", { name: "Turn off optional analytics" })
    );
    expect(storedDecision()).toBe("denied");
    fireEvent.click(
      screen.getByRole("button", { name: "Allow optional analytics" })
    );
    expect({
      decision: storedDecision(),
      status: screen.getByRole("status").textContent,
    }).toStrictEqual({
      decision: "granted",
      status: expect.stringContaining("Optional analytics are allowed"),
    });
  });

  it("honors Do Not Track without replacing a stored grant", () => {
    localStorage.setItem(
      ANALYTICS_PREFERENCE_KEY,
      JSON.stringify({
        decidedAt: "2026-01-01T00:00:00.000Z",
        decision: "granted",
        expiresAt: "2027-04-01T00:00:00.000Z",
        version: 1,
      })
    );
    withDoNotTrack("1", () => {
      render(<PrivacyPreferences presentation="section" />);
      const allow = screen.getByRole("button", {
        name: "Allow optional analytics",
      });
      expect(
        allow.hasAttribute("disabled") || allow.ariaDisabled === "true"
      ).toBeTruthy();
      fireEvent.click(allow);
      expect({
        decision: storedDecision(),
        status: screen.getByRole("status").textContent,
      }).toStrictEqual({
        decision: "granted",
        status:
          "Your browser's Do Not Track preference is on. Atlas will keep optional analytics off.",
      });
    });
  });

  it("updates the visible choice from a native storage event", () => {
    render(<PrivacyPreferences presentation="section" />);
    fireEvent.click(
      screen.getByRole("button", { name: "Allow optional analytics" })
    );
    const denied = JSON.stringify({
      decidedAt: "2026-10-18T00:00:00.000Z",
      decision: "denied",
      expiresAt: "2027-04-01T00:00:00.000Z",
      version: 1,
    });
    localStorage.setItem(ANALYTICS_PREFERENCE_KEY, denied);
    act(() => {
      window.dispatchEvent(
        new StorageEvent("storage", {
          key: ANALYTICS_PREFERENCE_KEY,
          newValue: denied,
          storageArea: localStorage,
        })
      );
    });
    expect(screen.getByRole("status").textContent).toBe(
      "Optional analytics are off for this browser."
    );
  });

  it("rereads storage when the privacy dialog opens", () => {
    render(<PrivacyPreferences />);
    localStorage.setItem(
      ANALYTICS_PREFERENCE_KEY,
      JSON.stringify({
        decidedAt: "2026-10-18T00:00:00.000Z",
        decision: "denied",
        expiresAt: "2027-04-01T00:00:00.000Z",
        version: 1,
      })
    );
    fireEvent.click(screen.getByRole("button", { name: "Privacy settings" }));
    expect(screen.getByRole("status").textContent).toBe(
      "Optional analytics are off for this browser."
    );
  });

  it("stays off when the browser cannot store a choice", () => {
    const setItem = Storage.prototype.setItem;
    Storage.prototype.setItem = () => {
      throw new Error("storage blocked");
    };
    try {
      render(<PrivacyPreferences presentation="section" />);
      fireEvent.click(
        screen.getByRole("button", { name: "Allow optional analytics" })
      );
      expect(screen.getByRole("status").textContent).toBe(
        "Atlas cannot save a preference in this browser, so optional analytics remain off."
      );
      expect(localStorage.getItem(ANALYTICS_PREFERENCE_KEY)).toBeNull();
    } finally {
      Storage.prototype.setItem = setItem;
    }
  });
});
