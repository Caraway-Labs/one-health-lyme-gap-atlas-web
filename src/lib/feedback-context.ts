import { usePathname } from "next/navigation";

import { explorerParams, VIEWS } from "@/features/geographic-explorer/model";
import type { FeedbackContext } from "@/generated/models";
import {
  FeedbackContextEvidenceView,
  FeedbackContextExplorerMetric,
  FeedbackContextExplorerView,
  FeedbackSubmissionRequestRouteId,
} from "@/generated/models";
import { ANALYTICS_RELEASE_VERSION } from "@/lib/atlas-analytics";

const FIPS = /^\d{5}$/;
const DATASET = /^[A-Za-z0-9._-]{1,64}$/;
const STATE = /^(?:ALL|[A-Z]{2})$/;

const EVIDENCE_VIEWS = new Set(
  Object.values(FeedbackContextEvidenceView) as string[]
);
const EXPLORER_VIEWS = new Set<string>(VIEWS);
const EXPLORER_METRICS = new Set(
  Object.values(FeedbackContextExplorerMetric) as string[]
);

export function feedbackAppVersion(): string {
  return ANALYTICS_RELEASE_VERSION;
}

export function feedbackRouteIdFromPathname(
  pathname: string
): FeedbackSubmissionRequestRouteId {
  const path = pathname.split(/[?#]/, 1)[0] || "/";
  if (path === "/geographic_explorer") {
    return FeedbackSubmissionRequestRouteId.geographic_explorer;
  }
  if (path === "/knowledge-graph" || path.startsWith("/knowledge-graph/")) {
    return FeedbackSubmissionRequestRouteId.evidence_library;
  }
  if (path === "/assistant" || path.startsWith("/assistant/")) {
    return FeedbackSubmissionRequestRouteId.assistant;
  }
  if (path === "/account") {
    return FeedbackSubmissionRequestRouteId.account;
  }
  if (path === "/privacy") {
    return FeedbackSubmissionRequestRouteId.privacy;
  }
  if (path === "/ai-ethics") {
    return FeedbackSubmissionRequestRouteId.ai_ethics;
  }
  return FeedbackSubmissionRequestRouteId.overview;
}

function omitEmptyContext(context: FeedbackContext): FeedbackContext | null {
  const entries = Object.entries(context).filter(([, value]) => {
    if (value == null) return false;
    if (Array.isArray(value) && value.length === 0) return false;
    if (value === "") return false;
    return true;
  });
  if (entries.length === 0) return null;
  return Object.fromEntries(entries) as FeedbackContext;
}

export type FeedbackContextInput = {
  pathname: string;
  state?: string | null;
  county?: string | null;
  compare?: string | null;
  selected?: string[] | null;
  dataset?: string | null;
  evidence?: string | null;
  view?: string | null;
  metric?: string | null;
  eco?: number | null;
  breakpoint?: number | null;
  missing?: number | null;
};

/**
 * Builds the closed feedback context allowlist from pathname and nuqs state.
 * Never includes `q`, chat text, raw URLs, or localStorage.
 */
export function buildFeedbackContext(
  input: FeedbackContextInput
): FeedbackContext | null {
  const routeId = feedbackRouteIdFromPathname(input.pathname);
  const context: FeedbackContext = {};

  if (
    routeId === FeedbackSubmissionRequestRouteId.overview ||
    routeId === FeedbackSubmissionRequestRouteId.geographic_explorer
  ) {
    if (input.state && STATE.test(input.state)) {
      context.state = input.state;
    }
    if (input.county && FIPS.test(input.county)) {
      context.county_fips = input.county;
    }
    if (input.compare && FIPS.test(input.compare)) {
      context.compare_county_fips = input.compare;
    }
    if (input.dataset && DATASET.test(input.dataset)) {
      context.dataset = input.dataset;
    }
    if (input.evidence && EVIDENCE_VIEWS.has(input.evidence)) {
      context.evidence_view =
        input.evidence as (typeof FeedbackContextEvidenceView)[keyof typeof FeedbackContextEvidenceView];
    }
    if (typeof input.eco === "number") {
      context.ecological_share = input.eco;
    }
    if (typeof input.breakpoint === "number") {
      context.low_incidence_breakpoint = input.breakpoint;
    }
    if (typeof input.missing === "number") {
      context.missing_human_weakness = input.missing;
    }
  }

  if (routeId === FeedbackSubmissionRequestRouteId.geographic_explorer) {
    if (input.view && EXPLORER_VIEWS.has(input.view)) {
      context.explorer_view =
        input.view as (typeof FeedbackContextExplorerView)[keyof typeof FeedbackContextExplorerView];
    }
    if (input.metric && EXPLORER_METRICS.has(input.metric)) {
      context.explorer_metric =
        input.metric as (typeof FeedbackContextExplorerMetric)[keyof typeof FeedbackContextExplorerMetric];
    }
    if (input.selected?.length) {
      context.selected_county_fips = [
        ...new Set(input.selected.filter((fips) => FIPS.test(fips))),
      ].slice(0, 5);
    }
  }

  return omitEmptyContext(context);
}

/**
 * Reads explorer/atlas search params from the current location without
 * `useQueryStates`, so FeedbackProvider can mount during static prerender.
 */
export function readFeedbackExplorerInput(): Omit<
  FeedbackContextInput,
  "pathname"
> {
  if (typeof window === "undefined") {
    return {};
  }
  const params = new URLSearchParams(window.location.search);
  return {
    state: explorerParams.state.parseServerSide(
      params.get("state") ?? undefined
    ),
    county: explorerParams.county.parseServerSide(
      params.get("county") ?? undefined
    ),
    compare: explorerParams.compare.parseServerSide(
      params.get("compare") ?? undefined
    ),
    selected: explorerParams.selected.parseServerSide(
      params.get("selected") ?? undefined
    ),
    dataset: explorerParams.dataset.parseServerSide(
      params.get("dataset") ?? undefined
    ),
    evidence: explorerParams.evidence.parseServerSide(
      params.get("evidence") ?? undefined
    ),
    view: explorerParams.view.parseServerSide(params.get("view") ?? undefined),
    metric: explorerParams.metric.parseServerSide(
      params.get("metric") ?? undefined
    ),
    eco: explorerParams.eco.parseServerSide(params.get("eco") ?? undefined),
    breakpoint: explorerParams.breakpoint.parseServerSide(
      params.get("breakpoint") ?? undefined
    ),
    missing: explorerParams.missing.parseServerSide(
      params.get("missing") ?? undefined
    ),
  };
}

export function resolveFeedbackPageContext(pathname: string): {
  routeId: FeedbackSubmissionRequestRouteId;
  context: FeedbackContext | null;
  appVersion: string;
} {
  return {
    routeId: feedbackRouteIdFromPathname(pathname),
    context: buildFeedbackContext({
      pathname,
      ...readFeedbackExplorerInput(),
    }),
    appVersion: feedbackAppVersion(),
  };
}

export function useFeedbackPageContext(): {
  routeId: FeedbackSubmissionRequestRouteId;
  context: FeedbackContext | null;
  appVersion: string;
  resolve: () => {
    routeId: FeedbackSubmissionRequestRouteId;
    context: FeedbackContext | null;
    appVersion: string;
  };
} {
  const pathname = usePathname();

  return {
    ...resolveFeedbackPageContext(pathname),
    resolve: () => resolveFeedbackPageContext(pathname),
  };
}
