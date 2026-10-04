/**
 * Independent UX Reset handoff specification for regression tests (#408).
 * Intentionally does NOT import UX_RESET_HANDOFF_* from production code.
 * Values mirror docs/ux-reset-cross-page-context.md as of the #408 contract story.
 */

import type { UxResetDestinationId } from "@/features/ux-reset/routes";

export const FIXTURE_SHARED_KEYS = [
  "scope",
  "county",
  "compare",
  "dataset",
  "period",
] as const;

export type FixtureSharedKey = (typeof FIXTURE_SHARED_KEYS)[number];

/** Keys a source route may export (outbound). */
export const FIXTURE_EXPORT_POLICY: Record<
  UxResetDestinationId,
  readonly FixtureSharedKey[]
> = {
  action: FIXTURE_SHARED_KEYS,
  assistant: ["county", "dataset"],
  compare: FIXTURE_SHARED_KEYS,
  explore: FIXTURE_SHARED_KEYS,
  feed: [],
  investigate: FIXTURE_SHARED_KEYS,
  review: FIXTURE_SHARED_KEYS,
  settings: [],
};

/** Keys a destination route may accept (inbound). */
export const FIXTURE_ACCEPT_POLICY: Record<
  UxResetDestinationId,
  readonly FixtureSharedKey[]
> = {
  action: FIXTURE_SHARED_KEYS,
  assistant: ["county", "dataset"],
  compare: FIXTURE_SHARED_KEYS,
  explore: ["scope", "county", "dataset", "period"],
  feed: [],
  investigate: ["scope", "county", "dataset", "period"],
  review: ["scope", "county", "dataset", "period"],
  settings: [],
};

export const FIXTURE_DESTINATION_IDS: readonly UxResetDestinationId[] = [
  "review",
  "explore",
  "investigate",
  "compare",
  "action",
  "assistant",
  "feed",
  "settings",
];

/** Canonical shared values after parsing (not raw URL noise). */
export const FIXTURE_CANONICAL_SHARED = {
  compareSerialized: "08001,08003",
  county: "08001",
  dataset: "alpha",
  period: "2023-01-01",
  scope: "CO",
} as const;

/** Explore `selected` when synthesizing compare (max two FIPS). */
export const FIXTURE_EXPLORE_SELECTED_SERIALIZED = "06085,06037";

export function fixtureEffectiveHandoffKeys(
  source: UxResetDestinationId,
  destination: UxResetDestinationId
): FixtureSharedKey[] {
  const exported = new Set(FIXTURE_EXPORT_POLICY[source]);
  return FIXTURE_ACCEPT_POLICY[destination].filter((key) => exported.has(key));
}

export type FixtureExpectedHandoff = {
  destination: UxResetDestinationId;
  retained: Record<string, string>;
  source: UxResetDestinationId;
};

/**
 * Expected retained query after canonicalization + policy, independent of
 * `uxResetContextHandoffSearchParams` implementation.
 */
export function fixtureExpectedHandoff(
  source: UxResetDestinationId,
  destination: UxResetDestinationId
): FixtureExpectedHandoff {
  const keys = fixtureEffectiveHandoffKeys(source, destination);
  const retained: Record<string, string> = {};
  for (const key of keys) {
    if (key === "scope") {
      retained.scope = FIXTURE_CANONICAL_SHARED.scope;
    }
    if (key === "county") {
      retained.county = FIXTURE_CANONICAL_SHARED.county;
    }
    if (key === "dataset") {
      retained.dataset = FIXTURE_CANONICAL_SHARED.dataset;
    }
    if (key === "period") {
      retained.period = FIXTURE_CANONICAL_SHARED.period;
    }
    if (key === "compare") {
      retained.compare = FIXTURE_CANONICAL_SHARED.compareSerialized;
    }
  }

  return {
    destination,
    retained,
    source,
  };
}

/** Keys present on the source URL that must not appear on the handoff URL. */
export function fixtureSourceKeysExpectedDropped(
  sourceParams: URLSearchParams,
  retained: Record<string, string>
): string[] {
  const retainedKeys = new Set(Object.keys(retained));
  const dropped = new Set<string>();
  for (const key of new Set(sourceParams.keys())) {
    if (!retainedKeys.has(key)) {
      dropped.add(key);
    }
  }
  return [...dropped].sort();
}

export function fixtureRichSourceQuery(
  source: UxResetDestinationId
): URLSearchParams {
  const params = new URLSearchParams({
    county: FIXTURE_CANONICAL_SHARED.county,
    compare: FIXTURE_CANONICAL_SHARED.compareSerialized,
    dataset: FIXTURE_CANONICAL_SHARED.dataset,
    period: FIXTURE_CANONICAL_SHARED.period,
    scope: FIXTURE_CANONICAL_SHARED.scope,
  });

  switch (source) {
    case "review": {
      params.set("sort", "score");
      break;
    }
    case "explore": {
      params.set("metric", "score");
      params.set("selected", FIXTURE_EXPLORE_SELECTED_SERIALIZED);
      params.set("view", "maps");
      break;
    }
    case "investigate": {
      params.set("eco", "70");
      params.set("evidence", "all");
      break;
    }
    case "compare": {
      params.set("metric", "score");
      break;
    }
    case "action": {
      params.set("plan", "outreach");
      break;
    }
    case "assistant": {
      params.set("conversation", "local-1");
      params.set("eco", "70");
      params.set("period", "2099-01-01");
      params.set("scope", "TX");
      break;
    }
    case "feed": {
      params.set("tab", "updates");
      break;
    }
    case "settings": {
      break;
    }
    default: {
      break;
    }
  }

  return params;
}

export const FIXTURE_HANDOFF_PAIRS = FIXTURE_DESTINATION_IDS.flatMap((source) =>
  FIXTURE_DESTINATION_IDS.map((destination) =>
    fixtureExpectedHandoff(source, destination)
  )
);

export type FixtureMalformedHandoffCase = {
  label: string;
  query: string;
  source: UxResetDestinationId;
  destination: UxResetDestinationId;
  retained: Record<string, string>;
  mustDrop: string[];
};

export const FIXTURE_MALFORMED_HANDOFF_CASES: FixtureMalformedHandoffCase[] = [
  {
    destination: "investigate",
    label: "ambiguous county params",
    mustDrop: ["county"],
    query: "county=bad&county=08001&dataset=alpha&scope=CO",
    retained: { dataset: "alpha", scope: "CO" },
    source: "review",
  },
  {
    destination: "action",
    label: "compare junk deduped and capped at two",
    mustDrop: [],
    query:
      "compare=08001,garbage,08001,08003,08005&county=08001&dataset=alpha&scope=CO",
    retained: {
      compare: "08001,08003",
      county: "08001",
      dataset: "alpha",
      scope: "CO",
    },
    source: "compare",
  },
  {
    destination: "investigate",
    label: "invalid calendar period",
    mustDrop: ["period"],
    query: "period=2026-02-30&county=08001&dataset=alpha&scope=CO",
    retained: { county: "08001", dataset: "alpha", scope: "CO" },
    source: "review",
  },
  {
    destination: "investigate",
    label: "scope whitespace canonicalized",
    mustDrop: [],
    query: "scope=%20CO%20&county=08001&dataset=alpha",
    retained: { county: "08001", dataset: "alpha", scope: "CO" },
    source: "review",
  },
  {
    destination: "compare",
    label: "duplicate compare query keys merged",
    mustDrop: [],
    query: "compare=08001&compare=08003&county=08001&dataset=alpha&scope=CO",
    retained: {
      compare: "08001,08003",
      county: "08001",
      dataset: "alpha",
      scope: "CO",
    },
    source: "review",
  },
  {
    destination: "compare",
    label: "explore selected synthesizes compare when compare absent",
    mustDrop: ["selected", "view"],
    query:
      "scope=CO&county=08001&dataset=alpha&selected=06085,06037,08001&view=maps&metric=score",
    retained: {
      compare: "06085,06037",
      county: "08001",
      dataset: "alpha",
      scope: "CO",
    },
    source: "explore",
  },
];
