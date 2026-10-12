import { resetAskAtlasWorkspaceHref } from "@/features/ux-reset/ask-atlas/workspace-href";
import {
  isUxResetDatasetId,
  parseCalendarIsoDate,
  parseCompareFipsList,
  serializeCompareFipsList,
} from "@/features/ux-reset/context-params";
import {
  RESET_ACTION_PATH,
  RESET_COMPARE_PATH,
  RESET_EXPLORE_PATH,
  RESET_INVESTIGATE_PATH,
  RESET_REVIEW_PATH,
} from "@/features/ux-reset/routes";
import { isCountyFips } from "@/lib/county-geography";

import {
  absentInheritedField,
  ASK_ATLAS_INHERITED_FIELD_KEYS,
  finalizeInheritedContext,
  parseAskAtlasInheritedContext,
  type AskAtlasInheritedContext,
  type AskAtlasInheritedField,
  type AskAtlasInheritedFieldKey,
  type AskAtlasSurface,
} from "./inherited-context";

/**
 * Page-local reference carried into Ask Atlas.
 * It is the originating page's already validated context, not a chat request
 * field and not retrieved surveillance evidence.
 */
export const ASK_ATLAS_PAGE_REFERENCE_PARAM = "page_ref";

const PAGE_REFERENCE_VERSION = 1;
const MAX_PAGE_REFERENCE_LENGTH = 4000;
const ACCEPTED_PAGE_REFERENCE_KEY =
  "one-health-lyme-gap-atlas:ask-atlas-accepted-page-reference:v1";
const MAX_ACCEPTED_PAGE_REFERENCES = 8;
const MEASURE_TOKEN_PATTERN = /^[A-Za-z0-9._-]{1,64}$/;
const SCOPE_PATTERN = /^[A-Z]{2}$/;

const ENCODED_KEYS = [
  "compare",
  "county",
  "dataset",
  "fields",
  "mapScope",
  "metric",
  "period",
  "scope",
  "surface",
  "v",
] as const;

type ParamReader = Pick<URLSearchParams, "get" | "getAll" | "has">;

type ReturnState = {
  compare: readonly string[];
  county: string | null;
  dataset: string | null;
  mapScope: string | null;
  metric: string | null;
  period: string | null;
  scope: string;
};

export type AskAtlasPageReference = {
  context: AskAtlasInheritedContext;
  returnTo: ReturnState;
};

export type AskAtlasPageReferenceState =
  | { kind: "absent" }
  | { clearHref: string; kind: "unverified" }
  | {
      clearHref: string;
      kind: "validated";
      reference: AskAtlasPageReference;
      removeHrefs: Partial<Record<AskAtlasInheritedFieldKey, string>>;
      returnHref: string;
    };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readScope(searchParams: ParamReader): string {
  const values = searchParams.has("scope") ? searchParams.getAll("scope") : [];
  if (values.length !== 1) {
    return "ALL";
  }
  const trimmed = values[0]?.trim() ?? "";
  if (trimmed === "ALL" || SCOPE_PATTERN.test(trimmed)) {
    return trimmed;
  }
  return "ALL";
}

function readMapScope(searchParams: ParamReader): string | null {
  if (!searchParams.has("map_scope")) {
    return null;
  }
  const values = searchParams.getAll("map_scope");
  if (values.length !== 1) {
    return null;
  }
  const trimmed = values[0]?.trim() ?? "";
  if (trimmed === "ALL" || SCOPE_PATTERN.test(trimmed)) {
    return trimmed;
  }
  return null;
}

function exactCounty(value: string | null): string | null {
  if (!value) {
    return null;
  }
  const trimmed = value.trim();
  return isCountyFips(trimmed) ? trimmed : null;
}

function exactPair(value: string): [string, string] | null {
  const parts = value.split(",");
  if (parts.length !== 2) {
    return null;
  }
  const parsed = parseCompareFipsList(value);
  if (
    parsed.length !== 2 ||
    serializeCompareFipsList(parsed) !== value.trim()
  ) {
    return null;
  }
  const [left, right] = parsed;
  if (!(left && right) || left === right) {
    return null;
  }
  return [left, right];
}

function exactPairParam(value: string | null): string[] {
  if (!value) {
    return [];
  }
  return exactPair(value.trim()) ?? [];
}

function optionalIdentityAgrees(
  field: AskAtlasInheritedField,
  value: string | null,
  accept: (id: string) => boolean
): boolean {
  if (field.state === "absent") {
    return value === null;
  }
  return value === field.id && accept(field.id);
}

function geographyAgrees(
  context: AskAtlasInheritedContext,
  returnTo: ReturnState
): boolean {
  const geography = context.fields.geography;
  if (context.surface === "compare") {
    if (geography.state !== "validated") {
      return returnTo.county === null && returnTo.compare.length === 0;
    }
    const pair = exactPair(geography.id);
    if (!pair || returnTo.compare.join(",") !== pair.join(",")) {
      return false;
    }
    return returnTo.county === null || pair.includes(returnTo.county);
  }
  if (
    returnTo.compare.length > 0 &&
    context.surface !== "investigate" &&
    context.surface !== "action"
  ) {
    return false;
  }
  if (geography.state !== "validated") {
    return returnTo.county === null;
  }
  return isCountyFips(geography.id) && returnTo.county === geography.id;
}

function returnStateAgrees(
  context: AskAtlasInheritedContext,
  returnTo: ReturnState
): boolean {
  if (!geographyAgrees(context, returnTo)) {
    return false;
  }
  if (
    !optionalIdentityAgrees(
      context.fields.release,
      returnTo.dataset,
      isUxResetDatasetId
    ) ||
    !optionalIdentityAgrees(
      context.fields.period,
      returnTo.period,
      (id) => parseCalendarIsoDate(id) === id
    )
  ) {
    return false;
  }
  if (!(returnTo.scope === "ALL" || SCOPE_PATTERN.test(returnTo.scope))) {
    return false;
  }
  if (context.surface === "explore") {
    const measure = context.fields.measure;
    const metric = measure.state === "validated" ? measure.id : null;
    if (returnTo.metric !== metric) {
      return false;
    }
    if (returnTo.metric && !MEASURE_TOKEN_PATTERN.test(returnTo.metric)) {
      return false;
    }
    if (
      returnTo.mapScope &&
      returnTo.mapScope !== "ALL" &&
      !SCOPE_PATTERN.test(returnTo.mapScope)
    ) {
      return false;
    }
    return true;
  }
  return returnTo.metric === null && returnTo.mapScope === null;
}

function returnPath(surface: AskAtlasSurface): string {
  switch (surface) {
    case "action": {
      return RESET_ACTION_PATH;
    }
    case "compare": {
      return RESET_COMPARE_PATH;
    }
    case "explore": {
      return RESET_EXPLORE_PATH;
    }
    case "investigate": {
      return RESET_INVESTIGATE_PATH;
    }
    case "review": {
      return RESET_REVIEW_PATH;
    }
    default: {
      const exhaustive: never = surface;
      return exhaustive;
    }
  }
}

export function askAtlasReturnLabel(surface: AskAtlasSurface): string {
  switch (surface) {
    case "action": {
      return "Return to suggested follow-up";
    }
    case "compare": {
      return "Return to Compare";
    }
    case "explore": {
      return "Return to Atlas Explorer";
    }
    case "investigate": {
      return "Return to county evidence";
    }
    case "review": {
      return "Return to Atlas Explorer";
    }
    default: {
      const exhaustive: never = surface;
      return exhaustive;
    }
  }
}

export function askAtlasReturnHref(reference: AskAtlasPageReference): string {
  const params = new URLSearchParams();
  params.set("scope", reference.returnTo.scope);
  if (reference.returnTo.county) {
    params.set("county", reference.returnTo.county);
  }
  if (reference.returnTo.compare.length === 2) {
    params.set("compare", serializeCompareFipsList(reference.returnTo.compare));
  }
  if (reference.returnTo.dataset) {
    params.set("dataset", reference.returnTo.dataset);
  }
  if (reference.returnTo.period) {
    params.set("period", reference.returnTo.period);
  }
  if (reference.context.surface === "explore") {
    if (reference.returnTo.metric) {
      params.set("metric", reference.returnTo.metric);
    }
    if (reference.returnTo.mapScope) {
      params.set("map_scope", reference.returnTo.mapScope);
    }
  }
  const query = params.toString();
  const path = returnPath(reference.context.surface);
  return query ? `${path}?${query}` : path;
}

function serializeAskAtlasPageReference(
  reference: AskAtlasPageReference
): string | null {
  if (!returnStateAgrees(reference.context, reference.returnTo)) {
    return null;
  }
  const encoded = JSON.stringify({
    compare: [...reference.returnTo.compare],
    county: reference.returnTo.county,
    dataset: reference.returnTo.dataset,
    fields: reference.context.fields,
    mapScope: reference.returnTo.mapScope,
    metric: reference.returnTo.metric,
    period: reference.returnTo.period,
    scope: reference.returnTo.scope,
    surface: reference.context.surface,
    v: PAGE_REFERENCE_VERSION,
  });
  if (encoded.length > MAX_PAGE_REFERENCE_LENGTH) {
    return null;
  }
  return encoded;
}

function parseSerializedPageReference(
  value: string
): AskAtlasPageReference | null {
  if (value.length === 0 || value.length > MAX_PAGE_REFERENCE_LENGTH) {
    return null;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    return null;
  }
  if (!isRecord(parsed)) {
    return null;
  }
  const keys = Object.keys(parsed).toSorted();
  if (
    keys.length !== ENCODED_KEYS.length ||
    ENCODED_KEYS.some((key) => !keys.includes(key))
  ) {
    return null;
  }
  if (parsed.v !== PAGE_REFERENCE_VERSION) {
    return null;
  }
  const context = parseAskAtlasInheritedContext(
    JSON.stringify({ fields: parsed.fields, surface: parsed.surface })
  );
  if (!context) {
    return null;
  }
  if (!Array.isArray(parsed.compare) || parsed.compare.length > 2) {
    return null;
  }
  const compare: string[] = [];
  for (const item of parsed.compare) {
    if (
      typeof item !== "string" ||
      !isCountyFips(item) ||
      compare.includes(item)
    ) {
      return null;
    }
    compare.push(item);
  }
  if (compare.length === 1) {
    return null;
  }
  const county =
    parsed.county === null
      ? null
      : exactCounty(typeof parsed.county === "string" ? parsed.county : null);
  if (parsed.county !== null && county !== parsed.county) {
    return null;
  }
  const dataset = parsed.dataset === null ? null : parsed.dataset;
  const period = parsed.period === null ? null : parsed.period;
  const metric = parsed.metric === null ? null : parsed.metric;
  const mapScope = parsed.mapScope === null ? null : parsed.mapScope;
  if (
    (dataset !== null && typeof dataset !== "string") ||
    (period !== null && typeof period !== "string") ||
    (metric !== null && typeof metric !== "string") ||
    (mapScope !== null && typeof mapScope !== "string") ||
    typeof parsed.scope !== "string"
  ) {
    return null;
  }
  const returnTo: ReturnState = {
    compare,
    county,
    dataset,
    mapScope,
    metric,
    period,
    scope: parsed.scope,
  };
  if (!returnStateAgrees(context, returnTo)) {
    return null;
  }
  return { context, returnTo };
}

function downgradedFields(
  context: AskAtlasInheritedContext
): AskAtlasInheritedContext["fields"] {
  const fields = { ...context.fields };
  const period = fields.period;
  if (
    period.state === "validated" &&
    parseCalendarIsoDate(period.id) !== period.id
  ) {
    fields.period = absentInheritedField();
  }
  const release = fields.release;
  if (release.state === "validated" && !isUxResetDatasetId(release.id)) {
    fields.release = absentInheritedField();
  }
  const measure = fields.measure;
  if (
    measure.state === "validated" &&
    !MEASURE_TOKEN_PATTERN.test(measure.id)
  ) {
    fields.measure = absentInheritedField();
  }
  return fields;
}

export function pageReferenceFromContext(
  context: AskAtlasInheritedContext,
  searchParams: ParamReader
): AskAtlasPageReference | null {
  const fields = downgradedFields(context);
  let county: string | null = null;
  let compare: string[] = [];
  const geography = fields.geography;
  if (geography.state === "validated") {
    if (context.surface === "compare") {
      const pair = exactPair(geography.id);
      if (pair) {
        compare = [...pair];
        const urlCounty = exactCounty(searchParams.get("county"));
        county = urlCounty && pair.includes(urlCounty) ? urlCounty : null;
      } else {
        fields.geography = absentInheritedField();
      }
    } else if (isCountyFips(geography.id)) {
      county = geography.id;
      if (context.surface === "investigate" || context.surface === "action") {
        compare = exactPairParam(searchParams.get("compare"));
      }
    } else {
      fields.geography = absentInheritedField();
    }
  }
  const finalized = finalizeInheritedContext({
    fields,
    surface: context.surface,
  });
  if (!finalized) {
    return null;
  }
  const measure = finalized.fields.measure;
  const release = finalized.fields.release;
  const period = finalized.fields.period;
  const reference: AskAtlasPageReference = {
    context: finalized,
    returnTo: {
      compare,
      county,
      dataset: release.state === "validated" ? release.id : null,
      mapScope:
        context.surface === "explore" ? readMapScope(searchParams) : null,
      metric:
        context.surface === "explore" && measure.state === "validated"
          ? measure.id
          : null,
      period: period.state === "validated" ? period.id : null,
      scope: readScope(searchParams),
    },
  };
  const encoded = serializeAskAtlasPageReference(reference);
  return encoded ? parseSerializedPageReference(encoded) : null;
}

function syncSharedParams(
  params: URLSearchParams,
  reference: AskAtlasPageReference
): void {
  if (reference.returnTo.county) {
    params.set("county", reference.returnTo.county);
  } else {
    params.delete("county");
  }
  if (reference.returnTo.dataset) {
    params.set("dataset", reference.returnTo.dataset);
  } else {
    params.delete("dataset");
  }
  params.delete("compare");
  params.delete("period");
}

export function askAtlasPageReferenceHref(
  pathname: string,
  searchParams: Pick<URLSearchParams, "toString">,
  reference: AskAtlasPageReference | null
): string {
  const params = new URLSearchParams(searchParams.toString());
  params.delete(ASK_ATLAS_PAGE_REFERENCE_PARAM);
  if (reference) {
    const encoded = serializeAskAtlasPageReference(reference);
    if (!encoded) {
      const query = params.toString();
      return query ? `${pathname}?${query}` : pathname;
    }
    syncSharedParams(params, reference);
    params.set(ASK_ATLAS_PAGE_REFERENCE_PARAM, encoded);
  }
  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
}

function rememberAcceptedPageReference(reference: AskAtlasPageReference): void {
  if (typeof window === "undefined") {
    return;
  }
  const encoded = serializeAskAtlasPageReference(reference);
  if (!encoded) {
    return;
  }
  const items = [
    encoded,
    ...readAcceptedPageReferences().filter((item) => item !== encoded),
  ].slice(0, MAX_ACCEPTED_PAGE_REFERENCES);
  try {
    sessionStorage.setItem(
      ACCEPTED_PAGE_REFERENCE_KEY,
      JSON.stringify({ items, v: 1 })
    );
  } catch {
    // A later read fails closed when this browser cannot retain the snapshot.
  }
}

function readAcceptedPageReferences(): string[] {
  if (typeof window === "undefined") {
    return [];
  }
  try {
    const raw = sessionStorage.getItem(ACCEPTED_PAGE_REFERENCE_KEY);
    if (!raw) {
      return [];
    }
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed) || parsed.v !== 1 || !Array.isArray(parsed.items)) {
      return [];
    }
    return parsed.items.filter(
      (item): item is string =>
        typeof item === "string" && item.length <= MAX_PAGE_REFERENCE_LENGTH
    );
  } catch {
    return [];
  }
}

function optionalReturnAgrees(
  candidate: string | null,
  accepted: string | null
): boolean {
  return candidate === null || candidate === accepted;
}

function acceptedSnapshotCovers(candidate: AskAtlasPageReference): boolean {
  for (const encoded of readAcceptedPageReferences()) {
    const accepted = parseSerializedPageReference(encoded);
    if (!accepted || accepted.context.surface !== candidate.context.surface) {
      continue;
    }
    const fieldsAgree = ASK_ATLAS_INHERITED_FIELD_KEYS.every((key) => {
      const urlField = candidate.context.fields[key];
      const storedField = accepted.context.fields[key];
      if (urlField.state === "absent") {
        return true;
      }
      return (
        storedField.state === "validated" &&
        storedField.id === urlField.id &&
        storedField.label === urlField.label
      );
    });
    if (!fieldsAgree) {
      continue;
    }
    const returnsAgree =
      candidate.returnTo.scope === accepted.returnTo.scope &&
      optionalReturnAgrees(
        candidate.returnTo.county,
        accepted.returnTo.county
      ) &&
      optionalReturnAgrees(
        candidate.returnTo.dataset,
        accepted.returnTo.dataset
      ) &&
      optionalReturnAgrees(
        candidate.returnTo.period,
        accepted.returnTo.period
      ) &&
      optionalReturnAgrees(
        candidate.returnTo.metric,
        accepted.returnTo.metric
      ) &&
      optionalReturnAgrees(
        candidate.returnTo.mapScope,
        accepted.returnTo.mapScope
      ) &&
      (candidate.returnTo.compare.length === 0 ||
        candidate.returnTo.compare.join(",") ===
          accepted.returnTo.compare.join(","));
    if (returnsAgree) {
      return true;
    }
  }
  return false;
}

export function askAtlasEntryHref(input: {
  context: AskAtlasInheritedContext | null;
  pathname: string;
  searchParams: ParamReader;
}): string {
  const base = resetAskAtlasWorkspaceHref(input.pathname, input.searchParams);
  const reference = input.context
    ? pageReferenceFromContext(input.context, input.searchParams)
    : null;
  if (!reference) {
    return base;
  }
  rememberAcceptedPageReference(reference);
  const url = new URL(base, "https://atlas.local");
  return askAtlasPageReferenceHref(url.pathname, url.searchParams, reference);
}

export function askAtlasPageReferenceWithoutField(
  reference: AskAtlasPageReference,
  key: AskAtlasInheritedFieldKey
): AskAtlasPageReference | null {
  const fields = {
    ...reference.context.fields,
    [key]: absentInheritedField(),
  };
  const context = finalizeInheritedContext({
    fields,
    surface: reference.context.surface,
  });
  if (!context) {
    return null;
  }
  const returnTo: ReturnState = { ...reference.returnTo };
  switch (key) {
    case "geography": {
      returnTo.county = null;
      returnTo.compare = [];
      break;
    }
    case "measure": {
      returnTo.metric = null;
      break;
    }
    case "period": {
      returnTo.period = null;
      break;
    }
    case "release": {
      returnTo.dataset = null;
      break;
    }
    case "source": {
      break;
    }
    default: {
      const exhaustive: never = key;
      return exhaustive;
    }
  }
  const encoded = serializeAskAtlasPageReference({ context, returnTo });
  return encoded ? parseSerializedPageReference(encoded) : null;
}

function singleParam(
  searchParams: ParamReader,
  key: string
): string | null | "conflict" {
  if (!searchParams.has(key)) {
    return null;
  }
  const values = searchParams.getAll(key);
  if (values.length !== 1) {
    return "conflict";
  }
  return values[0] ?? "conflict";
}

function sharedUrlAgrees(
  reference: AskAtlasPageReference,
  searchParams: ParamReader
): boolean {
  const county = singleParam(searchParams, "county");
  const dataset = singleParam(searchParams, "dataset");
  const period = singleParam(searchParams, "period");
  const compare = singleParam(searchParams, "compare");
  if (
    county === "conflict" ||
    dataset === "conflict" ||
    period === "conflict" ||
    compare === "conflict"
  ) {
    return false;
  }
  if (
    county &&
    county !== reference.returnTo.county &&
    !reference.returnTo.compare.includes(county)
  ) {
    return false;
  }
  if (dataset && dataset !== reference.returnTo.dataset) {
    return false;
  }
  if (period && period !== reference.returnTo.period) {
    return false;
  }
  if (!compare) {
    return true;
  }
  const pair = exactPair(compare);
  return (
    Boolean(pair) && pair?.join(",") === reference.returnTo.compare.join(",")
  );
}

function hrefWithoutReference(
  pathname: string,
  searchParams: Pick<URLSearchParams, "toString">
): string {
  return askAtlasPageReferenceHref(pathname, searchParams, null);
}

const ABSENT_PAGE_REFERENCE: AskAtlasPageReferenceState = { kind: "absent" };

let cachedPageReferenceKey = "";
let cachedPageReferenceState: AskAtlasPageReferenceState =
  ABSENT_PAGE_REFERENCE;

export function absentAskAtlasPageReference(): AskAtlasPageReferenceState {
  return ABSENT_PAGE_REFERENCE;
}

export function subscribeAskAtlasPageReference(
  onStoreChange: () => void
): () => void {
  window.addEventListener("storage", onStoreChange);
  return () => window.removeEventListener("storage", onStoreChange);
}

/** Stable client snapshot. Server rendering stays absent until this runs. */
export function readAskAtlasPageReferenceClient(
  pathname: string,
  search: string
): AskAtlasPageReferenceState {
  let record = "";
  try {
    record = sessionStorage.getItem(ACCEPTED_PAGE_REFERENCE_KEY) ?? "";
  } catch {
    record = "";
  }
  const key = `${pathname}?${search}\n${record}`;
  if (key === cachedPageReferenceKey) {
    return cachedPageReferenceState;
  }
  cachedPageReferenceKey = key;
  cachedPageReferenceState = readAskAtlasPageReference(
    pathname,
    new URLSearchParams(search)
  );
  return cachedPageReferenceState;
}

export function readAskAtlasPageReference(
  pathname: string,
  searchParams: URLSearchParams
): AskAtlasPageReferenceState {
  const clearHref = hrefWithoutReference(pathname, searchParams);
  if (!searchParams.has(ASK_ATLAS_PAGE_REFERENCE_PARAM)) {
    return ABSENT_PAGE_REFERENCE;
  }
  const values = searchParams.getAll(ASK_ATLAS_PAGE_REFERENCE_PARAM);
  const encoded = values.length === 1 ? values[0] : null;
  const reference = encoded ? parseSerializedPageReference(encoded) : null;
  // The address can claim any label. This browser shows it as validated only
  // when a source page already accepted that same id and label. Node test
  // runners have no window, so they inspect the link shape without a snapshot.
  if (
    !(
      reference &&
      sharedUrlAgrees(reference, searchParams) &&
      (typeof window === "undefined" || acceptedSnapshotCovers(reference))
    )
  ) {
    return { clearHref, kind: "unverified" };
  }
  const removeHrefs: Partial<Record<AskAtlasInheritedFieldKey, string>> = {};
  for (const key of ASK_ATLAS_INHERITED_FIELD_KEYS) {
    if (reference.context.fields[key].state !== "validated") {
      continue;
    }
    const next = askAtlasPageReferenceWithoutField(reference, key);
    removeHrefs[key] = askAtlasPageReferenceHref(pathname, searchParams, next);
  }
  return {
    clearHref,
    kind: "validated",
    reference,
    removeHrefs,
    returnHref: askAtlasReturnHref(reference),
  };
}
