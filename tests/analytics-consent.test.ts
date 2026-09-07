import { beforeEach, describe, expect, it } from "vitest";

import {
  ANALYTICS_PREFERENCE_KEY,
  analyticsMayStart,
  honorsDoNotTrack,
  readAnalyticsPreference,
  writeAnalyticsPreference,
} from "../src/lib/analytics-consent";

describe("analytics consent", () => {
  beforeEach(() => localStorage.clear());

  it("keeps optional analytics off until an explicit stored choice", () => {
    expect(readAnalyticsPreference(localStorage)).toBe("not-decided");
    expect(
      analyticsMayStart({ consent: "not-decided", doNotTrack: false })
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

  it("removes expired or malformed choices and continues to deny by default", () => {
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
    expect(localStorage.getItem(ANALYTICS_PREFERENCE_KEY)).toBeNull();
  });

  it("honors Do Not Track even when a visitor previously granted consent", () => {
    expect(honorsDoNotTrack({ doNotTrack: "1" } as Navigator)).toBeTruthy();
    expect(
      analyticsMayStart({ consent: "granted", doNotTrack: true })
    ).toBeFalsy();
  });
});
