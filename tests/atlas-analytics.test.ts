import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  ANALYTICS_RELEASE_VERSION,
  ANALYTICS_SCHEMA_VERSION,
  createAtlasAnalytics,
} from "../src/lib/atlas-analytics";

describe("Atlas Amplitude boundary", () => {
  const amplitude = {
    init: vi.fn(),
    reset: vi.fn(),
    setOptOut: vi.fn(),
    track: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    sessionStorage.clear();
  });

  it("does not load or emit anything until an explicit start", () => {
    const loadAmplitude = vi.fn(async () => amplitude);
    const analytics = createAtlasAnalytics(loadAmplitude);

    analytics.track({
      eventType: "atlas_route_viewed",
      properties: { route_id: "atlas_home", methodology_version: "v1" },
    });

    expect(loadAmplitude).not.toHaveBeenCalled();
    expect(amplitude.track).not.toHaveBeenCalled();
  });

  it("uses session-only identity and disables every automatic collection path", async () => {
    const analytics = createAtlasAnalytics(async () => amplitude);

    await analytics.start("synthetic-development-key");
    analytics.track({
      eventType: "atlas_ui_interaction",
      properties: {
        route_id: "atlas_home",
        control_id: "hero_explore_counties",
        action: "activated",
      },
    });

    expect(amplitude.init).toHaveBeenCalledWith(
      "synthetic-development-key",
      expect.objectContaining({
        autocapture: false,
        defaultTracking: false,
        fetchRemoteConfig: false,
        identityStorage: "sessionStorage",
        offline: "disabled",
        trackingOptions: {
          ipAddress: false,
          language: false,
          platform: false,
        },
      })
    );
    expect(amplitude.track).toHaveBeenCalledWith("atlas_ui_interaction", {
      schema_version: ANALYTICS_SCHEMA_VERSION,
      release_version: ANALYTICS_RELEASE_VERSION,
      route_id: "atlas_home",
      control_id: "hero_explore_counties",
      action: "activated",
    });
  });

  it("opts out and clears only vendor storage when consent is withdrawn", async () => {
    const analytics = createAtlasAnalytics(async () => amplitude);
    await analytics.start("synthetic-development-key");
    sessionStorage.setItem("AMP_session", "vendor-value");
    localStorage.setItem("amplitude_unsent", "vendor-value");
    localStorage.setItem("atlas.analytics-preference.v1", "keep-this-choice");

    analytics.stop();

    expect(amplitude.setOptOut).toHaveBeenLastCalledWith(true);
    expect(amplitude.reset).toHaveBeenCalledOnce();
    expect(sessionStorage.getItem("AMP_session")).toBeNull();
    expect(localStorage.getItem("amplitude_unsent")).toBeNull();
    expect(localStorage.getItem("atlas.analytics-preference.v1")).toBe(
      "keep-this-choice"
    );
  });
});
