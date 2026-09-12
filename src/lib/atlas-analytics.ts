type AmplitudeModule = {
  init: (apiKey: string, options: Record<string, unknown>) => unknown;
  reset: () => unknown;
  setOptOut: (optOut: boolean) => unknown;
  track: (eventType: string, properties: Record<string, unknown>) => unknown;
};

type AmplitudeLoader = () => Promise<AmplitudeModule>;

export const ANALYTICS_SCHEMA_VERSION = "atlas-analytics/v1";
export const ANALYTICS_RELEASE_VERSION = "atlas-web/0.1.0";

export const routeIds = [
  "atlas_home",
  "privacy",
  "knowledge_graph",
  "atlas_variant",
  "account",
  "assistant",
  "geographic_explorer",
  "ai_ethics",
] as const;

export type RouteId = (typeof routeIds)[number];

export const uiControlIds = [
  "hero_explore_counties",
  "hero_methodology",
  "nav_atlas",
  "nav_scoring",
  "nav_methods",
  "nav_variants",
  "nav_data_dictionary",
  "filter_state",
  "filter_evidence",
  "csv_download",
  "results_table_toggle",
  "summary_copy",
  "score_ecological_share",
  "score_low_incidence_breakpoint",
  "score_missing_human_weakness",
  "ranked_county_select",
  "county_summary_copy",
  "county_scoring_link",
  "pdf_export",
  "footer_privacy",
  "footer_back_to_atlas",
  "page_retry",
  "nav_home",
  "nav_variant_link",
  "nav_data_dictionary_close",
  "results_table_county_select",
  "methods_source_open",
  "evidence_chat_open",
  "evidence_chat_close",
  "evidence_chat_new",
  "evidence_chat_submit",
  "evidence_chat_history_clear",
  "evidence_chat_history_select",
  "evidence_chat_history_delete",
  "experiment_retry",
  "experiment_table_toggle",
  "experiment_step_select",
  "experiment_county_select",
  "assistant_demo_send",
  "assistant_demo_stop",
  "geo_retry",
  "geo_use_current_release",
  "geo_view_tiles",
  "geo_view_multiples",
  "geo_view_matrix",
  "geo_view_ranking",
  "geo_view_maps",
  "geo_view_scatter",
  "geo_view_compare",
  "geo_view_trends",
  "geo_state_tile_select",
  "geo_clear_filters",
  "geo_metric_select",
  "geo_county_select",
  "geo_retry_geometry",
  "geo_add_comparison",
  "geo_view_comparison",
  "geo_comparison_remove",
  "geo_pagination_previous",
  "geo_pagination_next",
  "geo_retry_maps",
] as const;

export type UiControlId = (typeof uiControlIds)[number];

/**
 * Creates the sole JSX attribute used by the consent-gated control listener.
 * Keeping callers typed prevents an arbitrary label, DOM content, or URL from
 * becoming an analytics property.
 */
export function analyticsControlAttributes(controlId: UiControlId): {
  "data-atlas-analytics-control": UiControlId;
} {
  return { "data-atlas-analytics-control": controlId };
}

export const geographySelectionSurfaces = [
  "map",
  "results_table",
  "ranked_list",
  "experiment",
] as const;

export type GeographySelectionSurface =
  (typeof geographySelectionSurfaces)[number];

export const scoreControlIds = [
  "score_ecological_share",
  "score_low_incidence_breakpoint",
  "score_missing_human_weakness",
] as const;

export type ScoreControlId = (typeof scoreControlIds)[number];

export type ContentSurface =
  | "methods_navigation"
  | "source_card"
  | "data_dictionary";

type AnalyticsEvent =
  | {
      eventType: "atlas_route_viewed";
      properties: { route_id: RouteId; methodology_version: string };
    }
  | {
      eventType: "atlas_ui_interaction";
      properties: {
        route_id: RouteId;
        control_id: UiControlId;
        action: "activated";
      };
    }
  | {
      eventType: "atlas_filter_applied";
      properties: {
        route_id: "atlas_home";
        filter_dimension: "state" | "evidence";
        filter_value:
          | "all"
          | "ecological"
          | "human"
          | "complete"
          | "state_selected";
      };
    }
  | {
      eventType: "atlas_geography_selected";
      properties: {
        route_id: "atlas_home";
        geography_level: "county";
        county_fips: string;
        selection_surface: GeographySelectionSurface;
      };
    }
  | {
      eventType: "atlas_score_change_committed";
      properties: {
        route_id: "atlas_home";
        score_control: ScoreControlId;
        score_value: number;
        change_source: "range_control";
      };
    }
  | {
      eventType: "atlas_methodology_opened";
      properties: { route_id: RouteId; content_surface: ContentSurface };
    }
  | {
      eventType: "atlas_provenance_opened";
      properties: { route_id: RouteId; content_surface: ContentSurface };
    }
  | {
      eventType: "atlas_csv_export_requested";
      properties: { route_id: "atlas_home"; export_scope: "ranking" };
    }
  | {
      eventType: "atlas_summary_copied";
      properties: { route_id: "atlas_home"; summary_kind: "county_briefing" };
    };

function routeIdForPathname(pathname: string): RouteId {
  if (pathname === "/privacy") return "privacy";
  if (pathname === "/knowledge-graph") return "knowledge_graph";
  if (pathname.startsWith("/variant_")) return "atlas_variant";
  if (pathname === "/account") return "account";
  if (pathname === "/assistant" || pathname.startsWith("/assistant/")) {
    return "assistant";
  }
  if (pathname === "/geographic_explorer") return "geographic_explorer";
  if (pathname === "/ai-ethics") return "ai_ethics";
  return "atlas_home";
}

function clearAmplitudeBrowserStorage(storage: Storage): void {
  for (let index = storage.length - 1; index >= 0; index -= 1) {
    const key = storage.key(index);
    if (key?.startsWith("AMP_") || key?.startsWith("amplitude")) {
      storage.removeItem(key);
    }
  }
}

function browserConfig(): Record<string, unknown> {
  return {
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
  };
}

export function createAtlasAnalytics(loadAmplitude: AmplitudeLoader) {
  let amplitude: AmplitudeModule | undefined;

  return {
    async start(apiKey: string | undefined): Promise<boolean> {
      if (!apiKey || amplitude) return Boolean(amplitude);

      amplitude = await loadAmplitude();
      amplitude.init(apiKey, browserConfig());
      amplitude.setOptOut(false);
      return true;
    },
    stop(): void {
      if (amplitude) {
        amplitude.setOptOut(true);
        amplitude.reset();
        amplitude = undefined;
      }
      clearAmplitudeBrowserStorage(window.sessionStorage);
      clearAmplitudeBrowserStorage(window.localStorage);
    },
    track(event: AnalyticsEvent): void {
      if (!amplitude) return;
      amplitude.track(event.eventType, {
        schema_version: ANALYTICS_SCHEMA_VERSION,
        release_version: ANALYTICS_RELEASE_VERSION,
        ...event.properties,
      });
    },
  };
}

export const atlasAnalytics = createAtlasAnalytics(
  async () => import("@amplitude/analytics-browser")
);

export function trackRouteView(
  pathname: string,
  methodologyVersion = "unavailable"
) {
  atlasAnalytics.track({
    eventType: "atlas_route_viewed",
    properties: {
      route_id: routeIdForPathname(pathname),
      methodology_version: methodologyVersion,
    },
  });
}

export function trackUiInteraction(
  pathname: string,
  controlId: UiControlId
): void {
  atlasAnalytics.track({
    eventType: "atlas_ui_interaction",
    properties: {
      route_id: routeIdForPathname(pathname),
      control_id: controlId,
      action: "activated",
    },
  });
}

export function trackFilterApplied(
  filterDimension: "state" | "evidence",
  filterValue: "all" | "ecological" | "human" | "complete" | "state_selected"
): void {
  atlasAnalytics.track({
    eventType: "atlas_filter_applied",
    properties: {
      route_id: "atlas_home",
      filter_dimension: filterDimension,
      filter_value: filterValue,
    },
  });
}

export function isCountyFips(value: string): boolean {
  return /^\d{5}$/.test(value);
}

export function trackGeographySelected(
  countyFips: string,
  selectionSurface: GeographySelectionSurface
): void {
  if (!isCountyFips(countyFips)) {
    return;
  }

  atlasAnalytics.track({
    eventType: "atlas_geography_selected",
    properties: {
      route_id: "atlas_home",
      geography_level: "county",
      county_fips: countyFips,
      selection_surface: selectionSurface,
    },
  });
}

export function isValidScoreValue(
  scoreControl: ScoreControlId,
  scoreValue: number
): boolean {
  if (!Number.isInteger(scoreValue)) {
    return false;
  }

  if (scoreControl === "score_ecological_share") {
    return scoreValue >= 40 && scoreValue <= 85 && scoreValue % 5 === 0;
  }
  if (scoreControl === "score_low_incidence_breakpoint") {
    return scoreValue >= 5 && scoreValue <= 25;
  }
  return scoreValue >= 40 && scoreValue <= 90 && scoreValue % 5 === 0;
}

export function trackScoreChangeCommitted(
  scoreControl: ScoreControlId,
  scoreValue: number
): void {
  if (!isValidScoreValue(scoreControl, scoreValue)) {
    return;
  }

  atlasAnalytics.track({
    eventType: "atlas_score_change_committed",
    properties: {
      route_id: "atlas_home",
      score_control: scoreControl,
      score_value: scoreValue,
      change_source: "range_control",
    },
  });
}

export function trackMethodologyOpened(
  pathname: string,
  contentSurface: ContentSurface
): void {
  atlasAnalytics.track({
    eventType: "atlas_methodology_opened",
    properties: {
      route_id: routeIdForPathname(pathname),
      content_surface: contentSurface,
    },
  });
}

export function trackProvenanceOpened(
  pathname: string,
  contentSurface: ContentSurface
): void {
  atlasAnalytics.track({
    eventType: "atlas_provenance_opened",
    properties: {
      route_id: routeIdForPathname(pathname),
      content_surface: contentSurface,
    },
  });
}

export function trackCsvExportRequested(): void {
  atlasAnalytics.track({
    eventType: "atlas_csv_export_requested",
    properties: { route_id: "atlas_home", export_scope: "ranking" },
  });
}

export function trackSummaryCopied(): void {
  atlasAnalytics.track({
    eventType: "atlas_summary_copied",
    properties: { route_id: "atlas_home", summary_kind: "county_briefing" },
  });
}

export function isUiControlId(value: string | undefined): value is UiControlId {
  return Boolean(value && uiControlIds.includes(value as UiControlId));
}

export type { AnalyticsEvent };
