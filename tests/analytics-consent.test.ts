import { beforeEach, describe, expect, it } from "vitest";

import {
  ANALYTICS_PREFERENCE_KEY,
  analyticsMayStart,
  honorsDoNotTrack,
  readAnalyticsPreference,
  readBrowserAnalyticsPreference,
  writeAnalyticsPreference,
  writeBrowserAnalyticsPreference,
} from "../src/lib/analytics-consent";

describe("analytics consent", () => {
  beforeEach(() => localStorage.clear());

  it("treats a missing preference as default-on when storage works", () => {
    expect(readAnalyticsPreference(localStorage)).toBe("not-decided");
    expect(
      analyticsMayStart({ consent: "not-decided", doNotTrack: false })
    ).toBeTruthy();
    expect(
      analyticsMayStart({ consent: "denied", doNotTrack: false })
    ).toBeFalsy();
    expect(
      analyticsMayStart({
        consent: "storage-unavailable",
        doNotTrack: false,
      })
    ).toBeFalsy();
    expect(localStorage.getItem(ANALYTICS_PREFERENCE_KEY)).toBeNull();
  });

  it("stores only a time-bounded choice after an affirmative action", () => {
    const now = new Date("2026-09-07T12:00:00.000Z");
    expect(writeAnalyticsPreference(localStorage, "granted", now)).toBe(
      "granted"
    );

    expect(readAnalyticsPreference(localStorage, now)).toBe("granted");
    expect(
      JSON.parse(localStorage.getItem(ANALYTICS_PREFERENCE_KEY) ?? "{}")
    ).toStrictEqual({
      decision: "granted",
      decidedAt: "2026-09-07T12:00:00.000Z",
      expiresAt: "2027-03-09T12:00:00.000Z",
      version: 1,
    });
  });

  it("removes expired or malformed choices and returns to the default-on path", () => {
    localStorage.setItem(
      ANALYTICS_PREFERENCE_KEY,
      JSON.stringify({
        decision: "granted",
        decidedAt: "2026-01-01T00:00:00.000Z",
        expiresAt: "2026-01-02T00:00:00.000Z",
        version: 1,
      })
    );
    expect(
      readAnalyticsPreference(
        localStorage,
        new Date("2026-01-03T00:00:00.000Z")
      )
    ).toBe("not-decided");
    expect(localStorage.getItem(ANALYTICS_PREFERENCE_KEY)).toBeNull();

    localStorage.setItem(ANALYTICS_PREFERENCE_KEY, "not json");
    expect(readAnalyticsPreference(localStorage)).toBe("not-decided");
    expect(
      analyticsMayStart({ consent: "not-decided", doNotTrack: false })
    ).toBeTruthy();
    expect(localStorage.getItem(ANALYTICS_PREFERENCE_KEY)).toBeNull();
  });

  it("returns storage-unavailable when the localStorage getter throws", () => {
    const descriptor = Object.getOwnPropertyDescriptor(window, "localStorage");
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      get() {
        throw new DOMException("storage denied", "SecurityError");
      },
    });
    try {
      expect(readBrowserAnalyticsPreference()).toBe("storage-unavailable");
      expect(writeBrowserAnalyticsPreference("granted")).toBe(
        "storage-unavailable"
      );
    } finally {
      if (descriptor) {
        Object.defineProperty(window, "localStorage", descriptor);
      }
    }
  });

  it("honors Do Not Track even when a visitor previously granted consent", () => {
    expect(honorsDoNotTrack({ doNotTrack: "1" } as Navigator)).toBeTruthy();
    expect(
      analyticsMayStart({ consent: "granted", doNotTrack: true })
    ).toBeFalsy();
    expect(
      analyticsMayStart({ consent: "not-decided", doNotTrack: true })
    ).toBeFalsy();
  });
});
