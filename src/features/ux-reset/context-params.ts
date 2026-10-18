import { createLoader, createMultiParser, createParser } from "nuqs";

import {
  canonicalCountyFromQueryValues,
  canonicalDatasetFromQuery,
  canonicalPeriodFromQuery,
  canonicalScopeFromQueryValues,
  mergeCompareQueryValues,
  serializeCompareFipsList,
} from "@/features/ux-reset/context-shared";

export {
  canonicalCountyFromQueryValues,
  canonicalDatasetFromQuery,
  canonicalPeriodFromQuery,
  canonicalScopeFromQueryValues,
  isUxResetDatasetId,
  mergeCompareQueryValues,
  parseCalendarIsoDate,
  parseCompareFipsList,
  parseUxResetSharedContext,
  readExploreSelectedFips,
  serializeCompareFipsList,
  sharedContextToSearchParams,
  UX_RESET_COMPARE_COUNTY_LIMIT,
  UX_RESET_HANDOFF_ACCEPTANCE,
  UX_RESET_HANDOFF_EXPORT,
  UX_RESET_PAGE_LOCAL_PARAM_KEYS,
  UX_RESET_SHARED_CONTEXT_PARAM_KEYS,
  uxResetSharedContextSchema,
} from "@/features/ux-reset/context-shared";
export type {
  SharedContextSerializeOptions,
  UxResetSharedContext,
  UxResetSharedContextParamKey,
} from "@/features/ux-reset/context-shared";

const reviewScopeParser = createMultiParser({
  parse: (values) => canonicalScopeFromQueryValues(values),
  serialize: (value) => [value],
})
  .withOptions({ clearOnDefault: false })
  .withDefault("ALL");

const countyFipsParser = createMultiParser({
  parse: (values) => canonicalCountyFromQueryValues(values),
  serialize: (value) => (value ? [value] : []),
});

const compareListParser = createMultiParser({
  parse: (values) => mergeCompareQueryValues(values),
  serialize: (value) =>
    value.length > 0 ? [serializeCompareFipsList(value)] : [],
}).withDefault([]);

const datasetParser = createMultiParser({
  parse: (values) => canonicalDatasetFromQuery(values),
  serialize: (value) => (value ? [value] : []),
});

const periodParser = createMultiParser({
  parse: (values) => canonicalPeriodFromQuery(values),
  serialize: (value) => (value ? [value] : []),
});

/**
 * Shared nuqs parsers for UX Reset routes. Pages compose these with local parsers;
 * only keys accepted by the handoff matrix should survive navigation.
 */
export const uxResetSharedContextParsers = {
  compare: compareListParser,
  county: countyFipsParser,
  dataset: datasetParser,
  period: periodParser,
  scope: reviewScopeParser,
};

/** nuqs server/client loader — must match `parseUxResetSharedContext` for the same URL. */
export const loadUxResetSharedContext = createLoader(
  uxResetSharedContextParsers
);

export const uxResetExploreLocalParsers = {
  map_scope: createParser({
    parse: (value) => value,
    serialize: String,
  }),
  metric: createParser({
    parse: (value) => value,
    serialize: String,
  }),
  page: createParser({
    parse: (value) => value,
    serialize: String,
  }),
  selected: compareListParser,
  view: createParser({
    parse: (value) => value,
    serialize: String,
  }),
};
