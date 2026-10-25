import { describe, expect, it } from "vitest";

import {
  AMPLITUDE_PROJECT_IDS,
  SYNTHETIC_AMPLITUDE_API_KEY,
  describeAnalyticsRuntime,
  isSyntheticAmplitudeApiKey,
  readAmplitudeProjectTarget,
} from "../src/lib/amplitude-deployment";

describe("Amplitude deployment routing", () => {
  it("recognizes only the all-zero Playwright key as synthetic", () => {
    expect(
      isSyntheticAmplitudeApiKey(SYNTHETIC_AMPLITUDE_API_KEY)
    ).toBeTruthy();
    expect(isSyntheticAmplitudeApiKey("synthetic-development-key")).toBeFalsy();
    expect(isSyntheticAmplitudeApiKey()).toBeFalsy();
    expect(SYNTHETIC_AMPLITUDE_API_KEY).not.toBe(
      AMPLITUDE_PROJECT_IDS.development
    );
  });

  it("maps production and development targets to distinct Amplitude project ids", () => {
    expect(AMPLITUDE_PROJECT_IDS.production).not.toBe(
      AMPLITUDE_PROJECT_IDS.development
    );
    expect(readAmplitudeProjectTarget()).toBe("production");
  });

  it("surfaces non-sensitive runtime blockers for operator diagnostics", () => {
    expect(
      describeAnalyticsRuntime({
        consent: "granted",
        doNotTrack: false,
        apiKey: "synthetic-development-key",
        projectTarget: "development",
      })
    ).toStrictEqual({
      blocker: null,
      projectTarget: "development",
      projectId: AMPLITUDE_PROJECT_IDS.development,
    });

    expect(
      describeAnalyticsRuntime({
        consent: "granted",
        doNotTrack: false,
        apiKey: undefined,
        projectTarget: "production",
      }).blocker
    ).toBe("missing_api_key");

    expect(
      describeAnalyticsRuntime({
        consent: "not-decided",
        doNotTrack: false,
        apiKey: "synthetic-development-key",
        projectTarget: "development",
      }).blocker
    ).toBeNull();
    expect(
      describeAnalyticsRuntime({
        consent: "denied",
        doNotTrack: false,
        apiKey: "synthetic-development-key",
      }).blocker
    ).toBe("consent_not_granted");
    expect(
      describeAnalyticsRuntime({
        consent: "not-decided",
        doNotTrack: true,
        apiKey: "synthetic-development-key",
      }).blocker
    ).toBe("do_not_track");
  });
});
