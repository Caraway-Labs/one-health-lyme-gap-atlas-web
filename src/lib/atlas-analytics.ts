import { LogLevel, OfflineDisabled } from "@amplitude/analytics-core";

import { isSyntheticAmplitudeApiKey } from "@/lib/amplitude-deployment";

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
  "front_porch",
  "privacy",
  "knowledge_graph",
  "atlas_variant",
  "account",
  "assistant",
  "geographic_explorer",
  "ai_ethics",
  "intelligence_feed",
  "atlas_explorer",
  "compare",
  "ask_atlas",
  "settings",
  "resources",
  "data_provenance",
  "documentation",
] as const;

export type RouteId = (typeof routeIds)[number];

export const uiControlIds = [
  "hero_explore_counties",
  "hero_methodology",
  "nav_data_dictionary",
  "filter_state",
  "filter_evidence",
  "csv_download",
  "results_table_toggle",
  "score_ecological_share",
  "score_smooth_k",
  "score_missing_human_weakness",
  "ranked_county_select",
  "county_summary_copy",
  "county_scoring_link",
  "pdf_export",
  "footer_privacy",
  "footer_back_to_atlas",
  "page_retry",
  "feed_sources_retry",
  "nav_data_dictionary_close",
  "results_table_county_select",
  "methods_source_open",
  "evidence_chat_open",
  "evidence_chat_close",
  "evidence_chat_new",
  "evidence_chat_submit",
  "evidence_chat_retry",
  "evidence_chat_edit_question",
  "evidence_chat_starter_prompt",
  "evidence_chat_history_clear",
  "evidence_chat_history_open",
  "evidence_chat_history_select",
  "evidence_chat_history_delete",
  "experiment_retry",
  "experiment_county_select",
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
  "feedback_open",
  "feedback_submit",
  "feedback_retry",
  "feedback_discard",
  "feedback_report_data_issue",
  "feedback_footer_open",
  "nav_brand",
  "nav_atlas_explorer",
  "nav_compare",
  "nav_ask_atlas",
  "nav_feed",
  "nav_resources",
  "nav_settings",
  "nav_data_provenance",
  "nav_docs",
  "workspace_sign_in",
  "workspace_sign_out",
  "explorer_county_select",
  "explorer_county_clear",
  "explorer_map_layer",
  "explorer_us_view",
  "explorer_fit_map",
  "explorer_view_county_evidence",
  "explorer_view_follow_up",
  "explorer_compare",
  "explorer_ask_atlas",
  "explorer_back_to_map",
  "explorer_retry_evidence",
  "explorer_retry_directory",
  "compare_state_filter",
  "compare_county_select",
  "compare_county_clear",
  "compare_swap",
  "compare_clear_pair",
  "compare_edit_counties",
  "compare_pdf_export",
  "settings_save_starting_view",
  "settings_profile_retry",
  "feed_item_open",
  "feed_retry",
  "feed_clear_filters",
  "feed_remove_filter",
] as const;

export const feedbackTopics = [
  "data_issue",
  "usability",
  "bug",
  "feature_idea",
  "general",
] as const;

export type FeedbackTopic = (typeof feedbackTopics)[number];

export const feedbackOutcomes = [
  "success",
  "validation_error",
  "throttled",
  "unavailable",
  "dismissed",
] as const;

export type FeedbackOutcome = (typeof feedbackOutcomes)[number];

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

/** Sidebar destination id to the stable control that opens that destination. */
export const workspaceNavControlIds = {
  assistant: "nav_ask_atlas",
  compare: "nav_compare",
  "data-provenance": "nav_data_provenance",
  docs: "nav_docs",
  explorer: "nav_atlas_explorer",
  feed: "nav_feed",
  resources: "nav_resources",
  settings: "nav_settings",
} as const satisfies Record<string, UiControlId>;

export function workspaceNavControlAttributes(
  routeId: string
): ReturnType<typeof analyticsControlAttributes> | undefined {
  if (!Object.hasOwn(workspaceNavControlIds, routeId)) {
    return undefined;
  }
  return analyticsControlAttributes(
    workspaceNavControlIds[routeId as keyof typeof workspaceNavControlIds]
  );
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
  "score_smooth_k",
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
        route_id: "atlas_home" | "intelligence_feed";
        filter_dimension:
          | "state"
          | "evidence"
          | "feed_source"
          | "feed_published";
        filter_value:
          | "all"
          | "ecological"
          | "human"
          | "complete"
          | "state_selected"
          | "source_selected"
          | "7d"
          | "30d"
          | "90d";
        active_filter_count?: number;
      };
    }
  | {
      eventType: "atlas_filter_cleared";
      properties: {
        route_id: "intelligence_feed";
        clear_scope: "single" | "all";
        active_filter_count: number;
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
    }
  | {
      eventType: "atlas_feedback_opened";
      properties: { feedback_topic: FeedbackTopic };
    }
  | {
      eventType: "atlas_feedback_submitted";
      properties: { feedback_topic: FeedbackTopic; outcome: FeedbackOutcome };
    }
  | {
      eventType: "atlas_feedback_outcome_viewed";
      properties: { outcome: FeedbackOutcome };
    };

function canonicalAnalyticsPathname(pathname: string): string {
  const withoutQuery = pathname.split(/[?#]/, 1)[0] || "/";
  if (withoutQuery.length > 1 && withoutQuery.endsWith("/")) {
    return withoutQuery.slice(0, -1);
  }
  return withoutQuery;
}

function isPathOrDescendant(pathname: string, path: string): boolean {
  return pathname === path || pathname.startsWith(`${path}/`);
}

export function routeIdForPathname(pathname: string): RouteId {
  const path = canonicalAnalyticsPathname(pathname);
  if (path === "/") return "front_porch";
  if (path === "/overview") return "atlas_home";
  if (path === "/privacy") return "privacy";
  if (path === "/knowledge-graph") return "knowledge_graph";
  // Retired /variant_* URLs 404. Unmatched paths still use the analytical shell,
  // so a consented visit still records a route view. Keep atlas_variant so that
  // miss stays distinct from Overview (atlas_home). Do not reuse this ID.
  if (path.startsWith("/variant_")) return "atlas_variant";
  if (path === "/account") return "account";
  if (path === "/assistant" || path.startsWith("/assistant/")) {
    return "assistant";
  }
  if (path === "/geographic_explorer") return "geographic_explorer";
  if (path === "/ai-ethics") return "ai_ethics";
  if (isPathOrDescendant(path, "/explore")) return "atlas_explorer";
  if (isPathOrDescendant(path, "/compare")) return "compare";
  if (isPathOrDescendant(path, "/askatlas")) return "ask_atlas";
  if (isPathOrDescendant(path, "/app/feed")) return "intelligence_feed";
  if (isPathOrDescendant(path, "/app/settings")) return "settings";
  if (isPathOrDescendant(path, "/resources")) return "resources";
  if (isPathOrDescendant(path, "/data-provenance")) return "data_provenance";
  // ADR 0020 keeps the docs site free of the analytics client. The id exists
  // so a path under /docs is not recorded as atlas_home.
  if (isPathOrDescendant(path, "/docs")) return "documentation";
  return "atlas_home";
}

function isAllowlistedValue(
  allowed: readonly string[],
  value: unknown
): boolean {
  return typeof value === "string" && allowed.includes(value);
}

const analyticsEnumAllowlists = {
  action: ["activated"],
  change_source: ["range_control"],
  clear_scope: ["single", "all"],
  content_surface: ["methods_navigation", "source_card", "data_dictionary"],
  control_id: uiControlIds,
  export_scope: ["ranking"],
  feedback_topic: feedbackTopics,
  filter_dimension: ["state", "evidence", "feed_source", "feed_published"],
  filter_value: [
    "all",
    "ecological",
    "human",
    "complete",
    "state_selected",
    "source_selected",
    "7d",
    "30d",
    "90d",
  ],
  geography_level: ["national", "state", "county"],
  outcome: feedbackOutcomes,
  route_id: routeIds,
  score_control: scoreControlIds,
  selection_surface: geographySelectionSurfaces,
  summary_kind: ["county_briefing"],
} as const;

/**
 * Drops an event locally when a closed enum property is missing from the
 * allowlist. Callers that already narrowed the value still pass.
 */
export function analyticsEnumsAllowed(
  properties: Record<string, unknown>
): boolean {
  for (const [key, allowed] of Object.entries(analyticsEnumAllowlists)) {
    if (key in properties && !isAllowlistedValue(allowed, properties[key])) {
      return false;
    }
  }
  return true;
}

function clearAmplitudeBrowserStorage(storage: Storage): void {
  for (let index = storage.length - 1; index >= 0; index -= 1) {
    const key = storage.key(index);
    if (key?.startsWith("AMP_") || key?.startsWith("amplitude")) {
      storage.removeItem(key);
    }
  }
}

function clearReachableAmplitudeStorage(readStorage: () => Storage): void {
  try {
    clearAmplitudeBrowserStorage(readStorage());
  } catch {
    // A denied storage getter must leave the page usable.
  }
}

export function getAmplitudeBrowserInitOptions(
  apiKey?: string
): Record<string, unknown> {
  return {
    autocapture: false,
    defaultTracking: false,
    enableDiagnostics: false,
    fetchRemoteConfig: false,
    identityStorage: "sessionStorage",
    // OfflineDisabled is null; the string "disabled" is truthy and blocks all flushes.
    offline: OfflineDisabled,
    trackingOptions: {
      ipAddress: false,
      language: false,
      platform: false,
    },
    // Ingestion rejects this key and the SDK reports that with console.error.
    // Next.js dev turns that into the error overlay, whose portal intercepts
    // pointer events. A real project key keeps the SDK's default log level.
    ...(isSyntheticAmplitudeApiKey(apiKey) ? { logLevel: LogLevel.None } : {}),
  };
}

export function createAtlasAnalytics(loadAmplitude: AmplitudeLoader) {
  let amplitude: AmplitudeModule | undefined;
  // stop() advances this so an import that resolves later cannot init or opt in.
  let startGeneration = 0;

  return {
    async start(apiKey: string | undefined): Promise<boolean> {
      if (!apiKey || amplitude) return Boolean(amplitude);

      const generation = startGeneration;
      const loaded = await loadAmplitude();
      if (generation !== startGeneration) return false;
      if (amplitude) return true;

      amplitude = loaded;
      amplitude.init(apiKey, getAmplitudeBrowserInitOptions(apiKey));
      amplitude.setOptOut(false);
      return true;
    },
    stop(): void {
      startGeneration += 1;
      if (amplitude) {
        amplitude.setOptOut(true);
        amplitude.reset();
        amplitude = undefined;
      }
      clearReachableAmplitudeStorage(() => window.sessionStorage);
      clearReachableAmplitudeStorage(() => window.localStorage);
    },
    track(event: AnalyticsEvent): void {
      if (!amplitude) return;
      if (!analyticsEnumsAllowed(event.properties as Record<string, unknown>)) {
        return;
      }
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

const FEED_SOURCE_FILTER_VALUES = ["all", "source_selected"] as const;
const FEED_PUBLISHED_FILTER_VALUES = ["7d", "30d", "90d", "all"] as const;
const FEED_CLEAR_SCOPES = ["single", "all"] as const;

export type FeedSourceFilterValue = (typeof FEED_SOURCE_FILTER_VALUES)[number];
export type FeedPublishedFilterValue =
  (typeof FEED_PUBLISHED_FILTER_VALUES)[number];
export type FeedClearScope = (typeof FEED_CLEAR_SCOPES)[number];

function isActiveFilterCount(value: number): boolean {
  return Number.isInteger(value) && value >= 0 && value <= 10;
}

function isFeedSourceFilterValue(
  value: string
): value is FeedSourceFilterValue {
  return FEED_SOURCE_FILTER_VALUES.some((item) => item === value);
}

function isFeedPublishedFilterValue(
  value: string
): value is FeedPublishedFilterValue {
  return FEED_PUBLISHED_FILTER_VALUES.some((item) => item === value);
}

export function trackFeedFilterApplied(
  dimension: "feed_source",
  filterValue: FeedSourceFilterValue,
  activeFilterCount: number
): void;
export function trackFeedFilterApplied(
  dimension: "feed_published",
  filterValue: FeedPublishedFilterValue,
  activeFilterCount: number
): void;
export function trackFeedFilterApplied(
  dimension: "feed_source" | "feed_published",
  filterValue: FeedSourceFilterValue | FeedPublishedFilterValue,
  activeFilterCount: number
): void {
  if (!isActiveFilterCount(activeFilterCount)) {
    return;
  }
  if (dimension === "feed_source" && !isFeedSourceFilterValue(filterValue)) {
    return;
  }
  if (
    dimension === "feed_published" &&
    !isFeedPublishedFilterValue(filterValue)
  ) {
    return;
  }
  atlasAnalytics.track({
    eventType: "atlas_filter_applied",
    properties: {
      active_filter_count: activeFilterCount,
      filter_dimension: dimension,
      filter_value: filterValue,
      route_id: "intelligence_feed",
    },
  });
}

export function trackFeedFilterCleared(
  clearScope: FeedClearScope,
  activeFilterCount: number
): void {
  if (!FEED_CLEAR_SCOPES.includes(clearScope)) {
    return;
  }
  if (!isActiveFilterCount(activeFilterCount)) {
    return;
  }
  atlasAnalytics.track({
    eventType: "atlas_filter_cleared",
    properties: {
      active_filter_count: activeFilterCount,
      clear_scope: clearScope,
      route_id: "intelligence_feed",
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
  if (scoreControl === "score_smooth_k") {
    return scoreValue >= 5 && scoreValue <= 200 && scoreValue % 5 === 0;
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

export function trackFeedbackOpened(feedbackTopic: FeedbackTopic): void {
  if (!feedbackTopics.includes(feedbackTopic)) return;
  atlasAnalytics.track({
    eventType: "atlas_feedback_opened",
    properties: { feedback_topic: feedbackTopic },
  });
}

export function trackFeedbackSubmitted(
  feedbackTopic: FeedbackTopic,
  outcome: FeedbackOutcome
): void {
  if (!feedbackTopics.includes(feedbackTopic)) return;
  if (!feedbackOutcomes.includes(outcome)) return;
  atlasAnalytics.track({
    eventType: "atlas_feedback_submitted",
    properties: { feedback_topic: feedbackTopic, outcome },
  });
}

export function trackFeedbackOutcomeViewed(outcome: FeedbackOutcome): void {
  if (!feedbackOutcomes.includes(outcome)) return;
  atlasAnalytics.track({
    eventType: "atlas_feedback_outcome_viewed",
    properties: { outcome },
  });
}

export function isUiControlId(value: string | undefined): value is UiControlId {
  return Boolean(value && uiControlIds.includes(value as UiControlId));
}

export type { AnalyticsEvent };
