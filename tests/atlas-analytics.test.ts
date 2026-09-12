import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  ANALYTICS_RELEASE_VERSION,
  ANALYTICS_SCHEMA_VERSION,
  analyticsControlAttributes,
  createAtlasAnalytics,
  isCountyFips,
  isUiControlId,
  isValidScoreValue,
  routeIds,
  uiControlIds,
} from "../src/lib/atlas-analytics";

describe("Atlas Amplitude boundary", () => {
  const amplitude = {
    init: vi.fn<
      (apiKey: string, options: Record<string, unknown>) => unknown
    >(),
    reset: vi.fn<() => unknown>(),
    setOptOut: vi.fn<(optOut: boolean) => unknown>(),
    track:
      vi.fn<
        (eventType: string, properties: Record<string, unknown>) => unknown
      >(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    sessionStorage.clear();
  });

  it("does not load or emit anything until an explicit start", () => {
    const loadAmplitude = vi.fn<() => Promise<typeof amplitude>>(
      async () => amplitude
    );
    const analytics = createAtlasAnalytics(loadAmplitude);

    analytics.track({
      eventType: "atlas_route_viewed",
      properties: { route_id: "atlas_home", methodology_version: "v1" },
    });

    expect(loadAmplitude).not.toHaveBeenCalled();
    expect(amplitude.track).not.toHaveBeenCalled();
  });

  it("uses unique typed route and control allowlists", () => {
    expect(new Set(routeIds)).toHaveLength(routeIds.length);
    expect(new Set(uiControlIds)).toHaveLength(uiControlIds.length);
    expect(isUiControlId("not_a_real_control")).toBeFalsy();
    expect(isUiControlId("hero_explore_counties")).toBeTruthy();
  });

  it("uses a unique, typed control allowlist for JSX instrumentation", () => {
    expect(analyticsControlAttributes("hero_explore_counties")).toStrictEqual({
      "data-atlas-analytics-control": "hero_explore_counties",
    });
    expect(uiControlIds).toStrictEqual(
      expect.arrayContaining([
        "geo_view_maps",
        "geo_state_tile_select",
        "geo_county_select",
        "geo_add_comparison",
        "geo_pagination_next",
        "experiment_retry",
        "experiment_table_toggle",
        "experiment_step_select",
        "experiment_county_select",
        "evidence_chat_history_clear",
        "evidence_chat_history_select",
        "evidence_chat_history_delete",
        "assistant_demo_send",
        "assistant_demo_stop",
      ])
    );
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

  it("emits county selection using only validated FIPS and a closed surface", async () => {
    const analytics = createAtlasAnalytics(async () => amplitude);
    await analytics.start("synthetic-development-key");

    analytics.track({
      eventType: "atlas_geography_selected",
      properties: {
        route_id: "atlas_home",
        geography_level: "county",
        county_fips: "08001",
        selection_surface: "map",
      },
    });

    expect(amplitude.track).toHaveBeenCalledWith("atlas_geography_selected", {
      schema_version: ANALYTICS_SCHEMA_VERSION,
      release_version: ANALYTICS_RELEASE_VERSION,
      route_id: "atlas_home",
      geography_level: "county",
      county_fips: "08001",
      selection_surface: "map",
    });
    expect(isCountyFips("08001")).toBeTruthy();
    expect(isCountyFips("Adams County")).toBeFalsy();

    analytics.track({
      eventType: "atlas_geography_selected",
      properties: {
        route_id: "atlas_home",
        geography_level: "county",
        county_fips: "08001",
        selection_surface: "experiment",
      },
    });
    expect(amplitude.track).toHaveBeenLastCalledWith(
      "atlas_geography_selected",
      expect.objectContaining({
        county_fips: "08001",
        selection_surface: "experiment",
      })
    );
  });

  it("emits only controlled score changes", async () => {
    const analytics = createAtlasAnalytics(async () => amplitude);
    await analytics.start("synthetic-development-key");
    analytics.track({
      eventType: "atlas_score_change_committed",
      properties: {
        route_id: "atlas_home",
        score_control: "score_ecological_share",
        score_value: 70,
        change_source: "range_control",
      },
    });

    expect(amplitude.track).toHaveBeenCalledWith(
      "atlas_score_change_committed",
      expect.objectContaining({
        score_control: "score_ecological_share",
        score_value: 70,
        change_source: "range_control",
      })
    );
    expect(isValidScoreValue("score_ecological_share", 70)).toBeTruthy();
    expect(isValidScoreValue("score_ecological_share", 71)).toBeFalsy();
  });

  it("does not attach free-text properties to chat or assistant control events", async () => {
    const analytics = createAtlasAnalytics(async () => amplitude);
    await analytics.start("synthetic-development-key");
    analytics.track({
      eventType: "atlas_ui_interaction",
      properties: {
        route_id: "knowledge_graph",
        control_id: "evidence_chat_history_delete",
        action: "activated",
      },
    });
    analytics.track({
      eventType: "atlas_ui_interaction",
      properties: {
        route_id: "assistant",
        control_id: "assistant_demo_send",
        action: "activated",
      },
    });

    for (const [, properties] of amplitude.track.mock.calls) {
      expect(properties).not.toHaveProperty("title");
      expect(properties).not.toHaveProperty("prompt");
      expect(properties).not.toHaveProperty("conversation_id");
      expect(properties).not.toHaveProperty("message");
      expect(Object.keys(properties).sort()).toStrictEqual([
        "action",
        "control_id",
        "release_version",
        "route_id",
        "schema_version",
      ]);
    }
  });
});
