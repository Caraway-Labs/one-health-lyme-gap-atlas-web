import { OfflineDisabled } from "@amplitude/analytics-core";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  ANALYTICS_RELEASE_VERSION,
  ANALYTICS_SCHEMA_VERSION,
  analyticsControlAttributes,
  analyticsEnumsAllowed,
  createAtlasAnalytics,
  getAmplitudeBrowserInitOptions,
  isCountyFips,
  isUiControlId,
  isValidScoreValue,
  routeIdForPathname,
  routeIds,
  trackFeedFilterApplied,
  trackFeedFilterCleared,
  uiControlIds,
  atlasAnalytics,
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

  it("validates smooth-k analytics without retaining the retired breakpoint control", () => {
    expect(
      [5, 50, 100, 200].every((value) =>
        isValidScoreValue("score_smooth_k", value)
      )
    ).toBeTruthy();
    expect(
      [0, 4, 51, 201, Number.NaN].some((value) =>
        isValidScoreValue("score_smooth_k", value)
      )
    ).toBeFalsy();
    expect(isUiControlId("score_low_incidence_breakpoint")).toBeFalsy();
    expect(isUiControlId("score_smooth_k")).toBeTruthy();
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

  it("classifies supported routes and keeps retired variant views distinct", () => {
    expect({
      account: routeIdForPathname("/account"),
      aiEthics: routeIdForPathname("/ai-ethics"),
      askAtlas: routeIdForPathname("/askatlas"),
      askAtlasQuery: routeIdForPathname("/askatlas?county=08001"),
      assistant: routeIdForPathname("/assistant"),
      assistantNested: routeIdForPathname("/assistant/conversation"),
      compare: routeIdForPathname("/compare"),
      dataProvenance: routeIdForPathname("/data-provenance"),
      documentation: routeIdForPathname("/docs/guide/"),
      explorer: routeIdForPathname("/explore"),
      explorerNested: routeIdForPathname("/explore/counties"),
      feed: routeIdForPathname("/app/feed"),
      feedNested: routeIdForPathname("/app/feed/item"),
      frontPorch: routeIdForPathname("/"),
      geographicExplorer: routeIdForPathname("/geographic_explorer"),
      investigate: routeIdForPathname("/investigate"),
      knowledgeGraph: routeIdForPathname("/knowledge-graph"),
      knownExplorer: routeIds.includes("atlas_explorer"),
      knownFrontPorch: routeIds.includes("front_porch"),
      knownVariant: routeIds.includes("atlas_variant"),
      legacyReview: routeIdForPathname("/app/review"),
      overview: routeIdForPathname("/overview"),
      privacy: routeIdForPathname("/privacy"),
      resources: routeIdForPathname("/resources"),
      retiredVariant: routeIdForPathname("/variant_1"),
      retiredVariantSeven: routeIdForPathname("/variant_7"),
      settings: routeIdForPathname("/app/settings/"),
      workspaceHome: routeIdForPathname("/app"),
    }).toStrictEqual({
      account: "account",
      aiEthics: "ai_ethics",
      askAtlas: "ask_atlas",
      askAtlasQuery: "ask_atlas",
      assistant: "assistant",
      assistantNested: "assistant",
      compare: "compare",
      dataProvenance: "data_provenance",
      documentation: "documentation",
      explorer: "atlas_explorer",
      explorerNested: "atlas_explorer",
      feed: "intelligence_feed",
      feedNested: "intelligence_feed",
      frontPorch: "front_porch",
      geographicExplorer: "geographic_explorer",
      investigate: "atlas_home",
      knowledgeGraph: "knowledge_graph",
      knownExplorer: true,
      knownFrontPorch: true,
      knownVariant: true,
      legacyReview: "atlas_home",
      overview: "atlas_home",
      privacy: "privacy",
      resources: "resources",
      retiredVariant: "atlas_variant",
      retiredVariantSeven: "atlas_variant",
      settings: "settings",
      workspaceHome: "atlas_home",
    });
  });

  it("emits closed Intelligence Feed filter values and drops raw source ids", () => {
    const track = vi.spyOn(atlasAnalytics, "track");
    trackFeedFilterApplied("feed_source", "source_selected", 1);
    trackFeedFilterApplied("feed_published", "7d", 2);
    trackFeedFilterCleared("single", 1);
    trackFeedFilterCleared("all", 0);
    trackFeedFilterApplied("feed_source", "cdc-lyme" as "all", 1);
    trackFeedFilterApplied("feed_published", "30d", 11);
    trackFeedFilterCleared("all", -1);

    expect(track.mock.calls).toStrictEqual([
      [
        {
          eventType: "atlas_filter_applied",
          properties: {
            active_filter_count: 1,
            filter_dimension: "feed_source",
            filter_value: "source_selected",
            route_id: "intelligence_feed",
          },
        },
      ],
      [
        {
          eventType: "atlas_filter_applied",
          properties: {
            active_filter_count: 2,
            filter_dimension: "feed_published",
            filter_value: "7d",
            route_id: "intelligence_feed",
          },
        },
      ],
      [
        {
          eventType: "atlas_filter_cleared",
          properties: {
            active_filter_count: 1,
            clear_scope: "single",
            route_id: "intelligence_feed",
          },
        },
      ],
      [
        {
          eventType: "atlas_filter_cleared",
          properties: {
            active_filter_count: 0,
            clear_scope: "all",
            route_id: "intelligence_feed",
          },
        },
      ],
    ]);
    expect(JSON.stringify(track.mock.calls)).not.toContain("cdc-lyme");
    track.mockRestore();
  });

  it("uses unique typed route and control allowlists", () => {
    expect(new Set(routeIds)).toHaveLength(routeIds.length);
    expect(new Set(uiControlIds)).toHaveLength(uiControlIds.length);
    expect(isUiControlId("not_a_real_control")).toBeFalsy();
    expect(isUiControlId("hero_explore_counties")).toBeTruthy();
  });

  it("rejects retired prototype control ids so they cannot be reused", () => {
    const retiredControlIds = [
      "assistant_demo_send",
      "assistant_demo_stop",
      "nav_atlas",
      "nav_home",
      "nav_methods",
      "nav_scoring",
      "nav_variant_link",
      "nav_variants",
      "summary_copy",
    ] as const;

    expect(
      Object.fromEntries(
        retiredControlIds.map((controlId) => [
          controlId,
          isUiControlId(controlId),
        ])
      )
    ).toStrictEqual({
      assistant_demo_send: false,
      assistant_demo_stop: false,
      nav_atlas: false,
      nav_home: false,
      nav_methods: false,
      nav_scoring: false,
      nav_variant_link: false,
      nav_variants: false,
      summary_copy: false,
    });
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
        "feed_sources_retry",
        "experiment_county_select",
        "evidence_chat_history_clear",
        "evidence_chat_history_select",
        "evidence_chat_history_delete",
        "evidence_chat_submit",
        "nav_atlas_explorer",
        "nav_compare",
        "nav_ask_atlas",
        "nav_settings",
        "nav_feed",
        "explorer_county_select",
        "explorer_compare",
        "compare_swap",
        "compare_pdf_export",
        "settings_save_starting_view",
        "feed_item_open",
        "workspace_sign_out",
      ])
    );
  });

  it("drops unknown route and control enums locally", async () => {
    const analytics = createAtlasAnalytics(async () => amplitude);
    await analytics.start("synthetic-development-key");

    analytics.track({
      eventType: "atlas_route_viewed",
      properties: {
        route_id: "not_a_route" as "atlas_home",
        methodology_version: "v1",
      },
    });
    analytics.track({
      eventType: "atlas_ui_interaction",
      properties: {
        route_id: "atlas_explorer",
        control_id: "not_a_control" as "nav_brand",
        action: "activated",
      },
    });
    analytics.track({
      eventType: "atlas_ui_interaction",
      properties: {
        route_id: "compare",
        control_id: "compare_swap",
        action: "clicked" as "activated",
      },
    });
    analytics.track({
      eventType: "atlas_route_viewed",
      properties: {
        route_id: "ask_atlas",
        methodology_version: "v1",
      },
    });

    expect({
      home: analyticsEnumsAllowed({ route_id: "atlas_home" }),
      retiredControl: analyticsEnumsAllowed({ control_id: "nav_home" }),
      settings: analyticsEnumsAllowed({ route_id: "settings" }),
      unknownRoute: analyticsEnumsAllowed({ route_id: "professional" }),
      validControl: analyticsEnumsAllowed({ control_id: "feed_retry" }),
    }).toStrictEqual({
      home: true,
      retiredControl: false,
      settings: true,
      unknownRoute: false,
      validControl: true,
    });
    expect(amplitude.track).toHaveBeenCalledExactlyOnceWith(
      "atlas_route_viewed",
      {
        schema_version: ANALYTICS_SCHEMA_VERSION,
        release_version: ANALYTICS_RELEASE_VERSION,
        route_id: "ask_atlas",
        methodology_version: "v1",
      }
    );
  });

  it("does not pass a truthy offline flag that suppresses Amplitude delivery", () => {
    const options = getAmplitudeBrowserInitOptions();
    expect(options.offline).toBe(OfflineDisabled);
    expect(Boolean(options.offline)).toBeFalsy();
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
        offline: OfflineDisabled,
        enableDiagnostics: false,
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

  it("does not initialize a pending SDK import after consent is withdrawn", async () => {
    const deferred = Promise.withResolvers<typeof amplitude>();
    const sdk = {
      init: vi.fn<
        (apiKey: string, options: Record<string, unknown>) => unknown
      >(() => {
        sessionStorage.setItem("AMP_session", "recreated");
        localStorage.setItem("amplitude_unsent", "recreated");
      }),
      reset: vi.fn<() => unknown>(),
      setOptOut: vi.fn<(optOut: boolean) => unknown>((optOut) => {
        if (!optOut) sessionStorage.setItem("AMP_session", "opted-in");
      }),
      track:
        vi.fn<
          (eventType: string, properties: Record<string, unknown>) => unknown
        >(),
    };
    const analytics = createAtlasAnalytics(() => deferred.promise);
    const started = analytics.start("synthetic-development-key");

    sessionStorage.setItem("AMP_session", "vendor-value");
    localStorage.setItem("amplitude_unsent", "vendor-value");
    analytics.stop();
    deferred.resolve(sdk);
    await started;
    analytics.track({
      eventType: "atlas_route_viewed",
      properties: { route_id: "account", methodology_version: "v1" },
    });

    expect(sdk.init).not.toHaveBeenCalled();
    expect(sdk.setOptOut).not.toHaveBeenCalledWith(false);
    expect(sdk.track).not.toHaveBeenCalled();
    expect(sessionStorage.getItem("AMP_session")).toBeNull();
    expect(localStorage.getItem("amplitude_unsent")).toBeNull();
  });

  it("initializes a fresh start after a withdrawn in-flight import", async () => {
    const deferred = Promise.withResolvers<typeof amplitude>();
    let loads = 0;
    const analytics = createAtlasAnalytics(async () => {
      loads += 1;
      if (loads === 1) return deferred.promise;
      return amplitude;
    });

    const withdrawnStart = analytics.start("synthetic-development-key");
    analytics.stop();
    deferred.resolve(amplitude);
    await withdrawnStart;
    await analytics.start("synthetic-development-key");
    analytics.track({
      eventType: "atlas_route_viewed",
      properties: { route_id: "account", methodology_version: "v1" },
    });

    expect(amplitude.init).toHaveBeenCalledOnce();
    expect(amplitude.setOptOut).toHaveBeenCalledWith(false);
    expect(amplitude.track).toHaveBeenCalledOnce();
  });

  it("clears vendor storage on opt-out when no preference record exists", async () => {
    const analytics = createAtlasAnalytics(async () => amplitude);
    await analytics.start("synthetic-development-key");
    sessionStorage.setItem("AMP_session", "vendor-value");
    localStorage.setItem("amplitude_unsent", "vendor-value");

    analytics.stop();

    expect(amplitude.setOptOut).toHaveBeenLastCalledWith(true);
    expect(amplitude.reset).toHaveBeenCalledOnce();
    expect(sessionStorage.getItem("AMP_session")).toBeNull();
    expect(localStorage.getItem("amplitude_unsent")).toBeNull();
    expect(localStorage.getItem("atlas.analytics-preference.v1")).toBeNull();
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
        control_id: "evidence_chat_submit",
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
