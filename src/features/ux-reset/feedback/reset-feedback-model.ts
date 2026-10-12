import { parseUxResetSharedContext } from "@/features/ux-reset/context-params";
import { findResetRoute } from "@/features/ux-reset/paths";
import {
  isLower48ReviewScope,
  STATE_FIPS_PREFIX,
} from "@/features/ux-reset/review/review-state-fips";
import { RESET_AI_RESPONSIBLE_USE_PATH } from "@/features/ux-reset/routes";
import {
  type FeedbackContext,
  FeedbackSubmissionRequestCategory,
  FeedbackSubmissionRequestRouteId,
  type FeedbackSubmissionRequest,
  type FeedbackSubmissionRequestCategory as FeedbackCategory,
} from "@/generated/models";
import { feedbackAppVersion } from "@/lib/feedback-context";

/**
 * UX Reset feedback mapping onto POST /v1/feedback.
 *
 * The live contract (WEB 64 and 65, API 42 and 43, DATA 129 and 130) is still the
 * five-category message plus optional contact_email. It has no dataset or
 * coverage category, no free-form contact, no structured suggestion fields,
 * and no UX Reset route ids. This module uses only fields that contract
 * accepts. Product category text is part of `message` so a person can triage
 * it. Names and organizations are not written into `message` or `contact_email`.
 */

export const RESET_FEEDBACK_HEADING = "Help shape One Health Atlas";

export const RESET_FEEDBACK_INTRO =
  "Have an idea, a useful dataset, or something we could improve? We'd love to hear it.";

const FALLBACK_RETRY_AFTER_SECONDS = 60;
const MESSAGE_MIN = 10;
const MESSAGE_MAX = 2000;
const CONTACT_EMAIL_MAX = 254;
const DATASET_REFERENCE_MAX = 300;
const NARRATIVE_MAX = 800;
const OPTIONAL_TEXT_MAX = 400;
const SHORT_TEXT_MAX = 200;

export const RESET_FEEDBACK_CATEGORIES = [
  {
    description: "Name a public dataset we should review.",
    id: "dataset",
    label: "Suggest a dataset",
  },
  {
    description: "Tell us what would make Atlas more useful.",
    id: "idea",
    label: "Share an idea",
  },
  {
    description: "Suggest a disease, vector, topic, or research question.",
    id: "expand",
    label: "Expand Atlas",
  },
  {
    description: "Report a bug, a confusing step, or data that looks wrong.",
    id: "problem",
    label: "Report a problem",
  },
] as const;

export type ResetFeedbackCategoryId =
  (typeof RESET_FEEDBACK_CATEGORIES)[number]["id"];

export const PROBLEM_KIND_OPTIONS = [
  { label: "Something broke", value: "bug" },
  { label: "Something is confusing", value: "usability" },
  { label: "Data looks wrong or missing", value: "data_issue" },
] as const;

export type ResetProblemKind = (typeof PROBLEM_KIND_OPTIONS)[number]["value"];

export type DatasetFeedbackDraft = {
  contact: string;
  frequency: string;
  geography: string;
  notes: string;
  reference: string;
  source: string;
  usefulness: string;
};

export type IdeaFeedbackDraft = {
  contact: string;
  details: string;
  improvement: string;
  outcome: string;
};

export type ExpandFeedbackDraft = {
  contact: string;
  details: string;
  outcome: string;
  sourceUrl: string;
  topic: string;
};

export type ProblemFeedbackDraft = {
  contact: string;
  details: string;
  expected: string;
  happened: string;
  kind: ResetProblemKind | "";
};

export type ResetFeedbackDrafts = {
  dataset: DatasetFeedbackDraft;
  expand: ExpandFeedbackDraft;
  idea: IdeaFeedbackDraft;
  problem: ProblemFeedbackDraft;
};

export type ResetFeedbackPage = {
  includeGeography: boolean;
  pageLabel: string;
  routeId: FeedbackSubmissionRequestRouteId;
};

type SearchParamReader = Pick<URLSearchParams, "get" | "getAll" | "has">;

type FeedbackSubmitFailureKind =
  | "conflict"
  | "rejected"
  | "throttled"
  | "unauthorized"
  | "unavailable";

export type FeedbackSubmitFailure = {
  kind: FeedbackSubmitFailureKind;
  message: string;
  retryAfterSeconds: number | null;
};

export type ResetFeedbackSubmission =
  | { error: string; ok: false }
  | {
      ok: true;
      request: FeedbackSubmissionRequest;
      topic: FeedbackCategory;
    };

const UNSUPPORTED_COVERAGE = /\b(?:alaska|hawaii|ak|hi)\b/i;

const URL_LIKE = /^(?:[a-z][a-z0-9+.-]*:|\/\/|www\.)/i;

export function createEmptyResetFeedbackDrafts(): ResetFeedbackDrafts {
  return {
    dataset: {
      contact: "",
      frequency: "",
      geography: "",
      notes: "",
      reference: "",
      source: "",
      usefulness: "",
    },
    expand: {
      contact: "",
      details: "",
      outcome: "",
      sourceUrl: "",
      topic: "",
    },
    idea: {
      contact: "",
      details: "",
      improvement: "",
      outcome: "",
    },
    problem: {
      contact: "",
      details: "",
      expected: "",
      happened: "",
      kind: "",
    },
  };
}

export function resetFeedbackDraftHasContent(
  drafts: ResetFeedbackDrafts
): boolean {
  return (
    textFields(drafts.dataset).some(hasText) ||
    textFields(drafts.idea).some(hasText) ||
    textFields(drafts.expand).some(hasText) ||
    textFields(drafts.problem).some(hasText) ||
    drafts.problem.kind !== ""
  );
}

export function resetFeedbackPage(pathname: string): ResetFeedbackPage {
  const path = pathname.split(/[?#]/, 1)[0] || "/";
  if (
    path === RESET_AI_RESPONSIBLE_USE_PATH ||
    path.startsWith(`${RESET_AI_RESPONSIBLE_USE_PATH}/`)
  ) {
    return {
      includeGeography: false,
      pageLabel: "AI responsible use",
      routeId: FeedbackSubmissionRequestRouteId.ai_ethics,
    };
  }

  const route = findResetRoute(path);
  if (!route || route.id === "docs") {
    return {
      includeGeography: false,
      pageLabel: route?.id === "docs" ? "Docs" : "Professional workspace",
      routeId: FeedbackSubmissionRequestRouteId.overview,
    };
  }

  return {
    includeGeography: geographyPage(route.id),
    pageLabel: route.label,
    routeId: routeIdForResetPage(route.id),
  };
}

export function buildResetFeedbackContext(
  pathname: string,
  searchParams: SearchParamReader
): FeedbackContext | null {
  const page = resetFeedbackPage(pathname);
  if (!page.includeGeography) return null;

  let shared: ReturnType<typeof parseUxResetSharedContext>;
  try {
    shared = parseUxResetSharedContext(searchParams);
  } catch {
    return null;
  }

  const context: FeedbackContext = {};
  const scope = singleRawParam(searchParams, "scope");
  if (scope === "ALL" || (scope != null && isLower48ReviewScope(scope))) {
    context.state = scope;
  }

  const supportedCompare = shared.compare.filter(isSupportedCountyFips);
  const primary = isSupportedCountyFips(shared.county ?? "")
    ? shared.county
    : (supportedCompare[0] ?? null);
  if (primary) {
    context.county_fips = primary;
  }

  const compareCounty = supportedCompare.find((fips) => fips !== primary);
  if (compareCounty) {
    context.compare_county_fips = compareCounty;
  }

  const selected = uniqueCounties(
    [primary, ...supportedCompare].filter((fips): fips is string =>
      Boolean(fips)
    )
  );
  if (selected.length > 1) {
    context.selected_county_fips = selected.slice(0, 5);
  }

  if (shared.dataset) {
    context.dataset = shared.dataset;
  }

  return omitEmptyContext(context);
}

export function buildResetFeedbackSubmission(input: {
  drafts: ResetFeedbackDrafts;
  pathname: string;
  searchParams: SearchParamReader;
  category: ResetFeedbackCategoryId;
  submissionToken: string;
}): ResetFeedbackSubmission {
  const page = resetFeedbackPage(input.pathname);
  const contactResult = resolveContactEmail(
    contactFor(input.drafts, input.category)
  );
  if ("error" in contactResult) {
    return { error: contactResult.error, ok: false };
  }

  const composed = composeMessage(input.category, input.drafts, page.pageLabel);
  if ("error" in composed) {
    return { error: composed.error, ok: false };
  }
  if (contactResult.email && composed.message.includes(contactResult.email)) {
    return {
      error:
        "Contact email has to stay out of the note. Clear it from the other fields.",
      ok: false,
    };
  }

  const category = apiCategory(input.category, input.drafts.problem.kind);
  if (!category) {
    return { error: "Choose what kind of problem this is.", ok: false };
  }

  return {
    ok: true,
    request: {
      app_version: feedbackAppVersion(),
      category,
      context: buildResetFeedbackContext(input.pathname, input.searchParams),
      message: composed.message,
      route_id: page.routeId,
      submission_token: input.submissionToken,
      ...(contactResult.email ? { contact_email: contactResult.email } : {}),
    },
    topic: category,
  };
}

export function classifyFeedbackHttpStatus(
  status: number,
  retryAfterSeconds: number | null
): FeedbackSubmitFailure {
  switch (status) {
    case 401: {
      return {
        kind: "unauthorized",
        message:
          "Your session expired. Sign in again, then resubmit. Your draft is still here. This was not sent anonymously.",
        retryAfterSeconds: null,
      };
    }
    case 409: {
      return {
        kind: "conflict",
        message:
          "This report token already matches a different submission. Keep your text, or submit it as a new report.",
        retryAfterSeconds: null,
      };
    }
    case 413:
    case 422: {
      return {
        kind: "rejected",
        message:
          "Atlas could not accept this note. Shorten it or check the fields, then try again. Your draft is still here.",
        retryAfterSeconds: null,
      };
    }
    case 429: {
      const seconds = retryAfterSeconds ?? FALLBACK_RETRY_AFTER_SECONDS;
      return {
        kind: "throttled",
        message: `Too many feedback requests. Try again in about ${seconds} seconds.`,
        retryAfterSeconds: seconds,
      };
    }
    default: {
      return {
        kind: "unavailable",
        message:
          "Atlas could not save your feedback right now. Your draft is kept—try again with the same report.",
        retryAfterSeconds: null,
      };
    }
  }
}

export function shouldKeepRetrySnapshot(status: number): boolean {
  return status === 0 || status === 429 || status >= 500;
}

export function feedbackRequestsMatch(
  left: FeedbackSubmissionRequest,
  right: FeedbackSubmissionRequest
): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

export function serverFeedbackId(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      trimmed
    )
  ) {
    return null;
  }
  return trimmed;
}

function composeMessage(
  category: ResetFeedbackCategoryId,
  drafts: ResetFeedbackDrafts,
  pageLabel: string
): { error: string } | { message: string } {
  switch (category) {
    case "dataset": {
      return composeDataset(drafts.dataset, pageLabel);
    }
    case "idea": {
      return composeIdea(drafts.idea, pageLabel);
    }
    case "expand": {
      return composeExpand(drafts.expand, pageLabel);
    }
    case "problem": {
      return composeProblem(drafts.problem, pageLabel);
    }
    default: {
      const exhaustive: never = category;
      return exhaustive;
    }
  }
}

function composeDataset(
  draft: DatasetFeedbackDraft,
  pageLabel: string
): { error: string } | { message: string } {
  const reference = singleLine(draft.reference, DATASET_REFERENCE_MAX);
  if ("error" in reference) return reference;
  if (reference.value.length < 2) {
    return { error: "Enter a dataset name or URL." };
  }
  const referenceKind = classifyDatasetReference(reference.value);
  if (referenceKind === "invalid-url") {
    return {
      error:
        "Enter an http or https URL, or a dataset name without a web address.",
    };
  }

  const usefulness = narrative(draft.usefulness, "Why this would be useful");
  if ("error" in usefulness) return usefulness;
  const geography = optionalLine(
    draft.geography,
    "Geographic coverage",
    SHORT_TEXT_MAX
  );
  if ("error" in geography) return geography;
  if (geography.value && UNSUPPORTED_COVERAGE.test(geography.value)) {
    return {
      error:
        "Geographic coverage can include the lower 48 states and Washington, DC. Alaska and Hawaii are not coverage targets.",
    };
  }

  const source = optionalLine(
    draft.source,
    "Source or publisher",
    SHORT_TEXT_MAX
  );
  if ("error" in source) return source;
  const frequency = optionalLine(
    draft.frequency,
    "Update frequency",
    SHORT_TEXT_MAX
  );
  if ("error" in frequency) return frequency;
  const notes = optionalLine(draft.notes, "Notes", OPTIONAL_TEXT_MAX);
  if ("error" in notes) return notes;

  return finishMessage(pageLabel, "Suggest a dataset", [
    `Dataset: ${reference.value}`,
    `Why useful: ${usefulness.value}`,
    source.value ? `Source or publisher: ${source.value}` : null,
    geography.value ? `Geographic coverage: ${geography.value}` : null,
    frequency.value ? `Update frequency: ${frequency.value}` : null,
    notes.value ? `Notes: ${notes.value}` : null,
  ]);
}

function composeIdea(
  draft: IdeaFeedbackDraft,
  pageLabel: string
): { error: string } | { message: string } {
  const improvement = narrative(draft.improvement, "What should we improve");
  if ("error" in improvement) return improvement;
  const outcome = narrative(draft.outcome, "Problem or outcome");
  if ("error" in outcome) return outcome;
  const details = optionalLine(draft.details, "Details", OPTIONAL_TEXT_MAX);
  if ("error" in details) return details;
  return finishMessage(pageLabel, "Share an idea", [
    `Improvement: ${improvement.value}`,
    `Problem or outcome: ${outcome.value}`,
    details.value ? `Details: ${details.value}` : null,
  ]);
}

function composeExpand(
  draft: ExpandFeedbackDraft,
  pageLabel: string
): { error: string } | { message: string } {
  const topic = boundedText(
    draft.topic,
    "What Atlas should cover",
    2,
    NARRATIVE_MAX
  );
  if ("error" in topic) return topic;
  const outcome = narrative(draft.outcome, "Problem or outcome");
  if ("error" in outcome) return outcome;
  const sourceUrl = singleLine(draft.sourceUrl, DATASET_REFERENCE_MAX);
  if ("error" in sourceUrl) return sourceUrl;
  if (sourceUrl.value && !isSafePublicUrl(sourceUrl.value)) {
    return {
      error: "Enter an http or https URL, or leave the public URL blank.",
    };
  }
  const details = optionalLine(draft.details, "Details", OPTIONAL_TEXT_MAX);
  if ("error" in details) return details;
  return finishMessage(pageLabel, "Expand Atlas", [
    `Suggestion: ${topic.value}`,
    `Problem or outcome: ${outcome.value}`,
    sourceUrl.value ? `Public source: ${sourceUrl.value}` : null,
    details.value ? `Details: ${details.value}` : null,
  ]);
}

function composeProblem(
  draft: ProblemFeedbackDraft,
  pageLabel: string
): { error: string } | { message: string } {
  if (!draft.kind) {
    return { error: "Choose what kind of problem this is." };
  }
  const happened = narrative(draft.happened, "What happened");
  if ("error" in happened) return happened;
  const expected = narrative(draft.expected, "What you expected");
  if ("error" in expected) return expected;
  const details = optionalLine(draft.details, "Details", OPTIONAL_TEXT_MAX);
  if ("error" in details) return details;
  const kindLabel = PROBLEM_KIND_OPTIONS.find(
    (option) => option.value === draft.kind
  )?.label;
  if (!kindLabel) {
    return { error: "Choose what kind of problem this is." };
  }
  return finishMessage(pageLabel, "Report a problem", [
    `Problem type: ${kindLabel}`,
    `What happened: ${happened.value}`,
    `Expected: ${expected.value}`,
    details.value ? `Details: ${details.value}` : null,
  ]);
}

function finishMessage(
  pageLabel: string,
  productCategory: string,
  lines: (string | null)[]
): { error: string } | { message: string } {
  const message = [
    `Product category: ${productCategory}`,
    `Page: ${pageLabel}`,
    "",
    ...lines.filter((line): line is string => Boolean(line)),
  ].join("\n");
  if (message.length < MESSAGE_MIN) {
    return { error: "Add a little more detail so we can understand the note." };
  }
  if (message.length > MESSAGE_MAX) {
    return {
      error: "Shorten the note so it is 2,000 characters or fewer.",
    };
  }
  return { message };
}

function apiCategory(
  category: ResetFeedbackCategoryId,
  problemKind: ProblemFeedbackDraft["kind"]
): FeedbackCategory | null {
  switch (category) {
    case "dataset": {
      return FeedbackSubmissionRequestCategory.general;
    }
    case "idea":
    case "expand": {
      return FeedbackSubmissionRequestCategory.feature_idea;
    }
    case "problem": {
      switch (problemKind) {
        case "bug": {
          return FeedbackSubmissionRequestCategory.bug;
        }
        case "usability": {
          return FeedbackSubmissionRequestCategory.usability;
        }
        case "data_issue": {
          return FeedbackSubmissionRequestCategory.data_issue;
        }
        case "": {
          return null;
        }
        default: {
          const exhaustive: never = problemKind;
          return exhaustive;
        }
      }
    }
    default: {
      const exhaustive: never = category;
      return exhaustive;
    }
  }
}

function resolveContactEmail(
  value: string
): { email?: string } | { error: string } {
  const trimmed = singleLine(value, 500);
  if ("error" in trimmed) {
    return {
      error:
        "Follow-up contact can only be stored as an email address. Enter an email, or clear the field to send without contact.",
    };
  }
  if (!trimmed.value) return {};
  if (
    trimmed.value.length > CONTACT_EMAIL_MAX ||
    !isContactEmail(trimmed.value)
  ) {
    return {
      error:
        "Follow-up contact can only be stored as an email address. Enter an email, or clear the field to send without contact. Names and organizations are not saved.",
    };
  }
  return { email: trimmed.value };
}

function isContactEmail(value: string): boolean {
  if (value.length > CONTACT_EMAIL_MAX || /\s/.test(value)) return false;
  const at = value.indexOf("@");
  return at > 0 && at === value.lastIndexOf("@") && at < value.length - 1;
}

function classifyDatasetReference(
  value: string
): "invalid-url" | "name" | "url" {
  if (!URL_LIKE.test(value)) return "name";
  return isSafePublicUrl(value) ? "url" : "invalid-url";
}

function isSafePublicUrl(value: string): boolean {
  if (value.startsWith("//")) return false;
  const candidate = /^www\./i.test(value) ? `https://${value}` : value;
  try {
    const url = new URL(candidate);
    if (url.protocol !== "http:" && url.protocol !== "https:") return false;
    if (url.username || url.password) return false;
    return url.hostname.length > 0;
  } catch {
    return false;
  }
}

function narrative(
  value: string,
  label: string
): { error: string } | { value: string } {
  return boundedText(value, label, MESSAGE_MIN, NARRATIVE_MAX);
}

function optionalLine(
  value: string,
  label: string,
  max: number
): { error: string } | { value: string } {
  return boundedText(value, label, 0, max);
}

function boundedText(
  value: string,
  label: string,
  min: number,
  max: number
): { error: string } | { value: string } {
  const trimmed = value.replaceAll("\u0000", "").trim();
  if (trimmed.length < min) {
    return { error: `${label} needs at least ${min} characters.` };
  }
  if (trimmed.length > max) {
    return {
      error: `${label} must be ${max.toLocaleString("en-US")} characters or fewer.`,
    };
  }
  return { value: trimmed };
}

function singleLine(
  value: string,
  max: number
): { error: string } | { value: string } {
  const flattened = value.replaceAll(/[\r\n]+/g, " ");
  const result = boundedText(flattened, "This field", 0, max);
  if ("error" in result && result.error.startsWith("This field")) {
    return { error: `Use ${max.toLocaleString("en-US")} characters or fewer.` };
  }
  return result;
}

function contactFor(
  drafts: ResetFeedbackDrafts,
  category: ResetFeedbackCategoryId
): string {
  switch (category) {
    case "dataset": {
      return drafts.dataset.contact;
    }
    case "idea": {
      return drafts.idea.contact;
    }
    case "expand": {
      return drafts.expand.contact;
    }
    case "problem": {
      return drafts.problem.contact;
    }
    default: {
      const exhaustive: never = category;
      return exhaustive;
    }
  }
}

function routeIdForResetPage(id: string): FeedbackSubmissionRequestRouteId {
  switch (id) {
    case "explore": {
      return FeedbackSubmissionRequestRouteId.geographic_explorer;
    }
    case "assistant": {
      return FeedbackSubmissionRequestRouteId.assistant;
    }
    case "overview":
    case "review":
    case "explorer":
    case "investigate":
    case "compare":
    case "action":
    case "feed":
    case "docs": {
      return FeedbackSubmissionRequestRouteId.overview;
    }
    case "settings": {
      return FeedbackSubmissionRequestRouteId.account;
    }
    default: {
      return FeedbackSubmissionRequestRouteId.overview;
    }
  }
}

function geographyPage(id: string): boolean {
  switch (id) {
    case "overview":
    case "review":
    case "explorer":
    case "explore":
    case "investigate":
    case "compare":
    case "action":
    case "assistant": {
      return true;
    }
    case "feed":
    case "settings":
    case "docs": {
      return false;
    }
    default: {
      return false;
    }
  }
}

function isSupportedCountyFips(fips: string): boolean {
  if (!/^\d{5}$/.test(fips)) return false;
  const prefix = fips.slice(0, 2);
  for (const [postal, statePrefix] of Object.entries(STATE_FIPS_PREFIX)) {
    if (statePrefix === prefix) {
      return isLower48ReviewScope(postal);
    }
  }
  return false;
}

function uniqueCounties(values: readonly string[]): string[] {
  const unique: string[] = [];
  for (const value of values) {
    if (!unique.includes(value)) unique.push(value);
  }
  return unique;
}

function singleRawParam(
  searchParams: SearchParamReader,
  key: string
): string | null {
  const values = searchParams.getAll(key).map((value) => value.trim());
  if (values.length !== 1) return null;
  return values[0] ?? null;
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

function textFields(value: object): string[] {
  return Object.values(value).filter(
    (entry): entry is string => typeof entry === "string"
  );
}

function hasText(value: string): boolean {
  return value.trim().length > 0;
}
