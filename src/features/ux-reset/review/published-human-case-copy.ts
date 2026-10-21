import type { CountyDetail } from "@/generated/models";

/** Observation year for the published county case and incidence fields. */
export const PUBLISHED_LYME_CASE_YEAR = "2023";

export const MINIMUM_REPORTED_CASES_LABEL = "Minimum reported cases";
export const MINIMUM_REPORTED_INCIDENCE_LABEL = "Minimum reported incidence";
export const REPORTED_CASES_LABEL = "Reported cases";
export const REPORTED_INCIDENCE_LABEL = "Reported incidence";

export const MINIMUM_REPORTED_CASES_TOOLTIP =
  "The published data establish a minimum number of reported cases. The actual reported total may be higher.";

export const MINIMUM_REPORTED_INCIDENCE_TOOLTIP =
  "The published data establish a minimum reported incidence. The actual reported rate may be higher.";

export const PUBLISHED_CASE_VALUES_UNAVAILABLE =
  "A 2023 minimum reported case count was published, but the count and rate are unavailable.";

/**
 * A published lower bound is usable only with the floor status and a finite,
 * non-negative value. Missing, suppressed, and other statuses stay null.
 */
export function publishedHumanFloorValue(
  status: string,
  value: number | null
): number | null {
  if (
    status === "published_count_floor" &&
    value !== null &&
    Number.isFinite(value) &&
    value >= 0
  ) {
    return value;
  }
  return null;
}

export function formatPublishedCaseCount(count: number): string {
  return count.toLocaleString("en-US");
}

/** Card narrative keeps one decimal place, matching the previous rate sentence. */
export function formatPublishedIncidenceRate(rate: number): string {
  return rate.toLocaleString("en-US", {
    maximumFractionDigits: 1,
    minimumFractionDigits: 1,
  });
}

export function publishedCaseCountExplanation(count: number): string {
  return `At least ${formatPublishedCaseCount(count)} Lyme disease cases were reported in ${PUBLISHED_LYME_CASE_YEAR}.`;
}

export function publishedIncidenceExplanation(formattedRate: string): string {
  return `At least ${formattedRate} reported cases per 100,000 residents.`;
}

export function compactPublishedCaseCount(count: number): string {
  return `Reported cases: ${formatPublishedCaseCount(count)} or more`;
}

export type PublishedLymeCaseMeasure = {
  label: string;
  sentence: string;
  explanation: string;
};

export type PublishedLymeCasePresentation = {
  measures: readonly PublishedLymeCaseMeasure[];
  text: string;
};

function statusSentence(detail: CountyDetail): string {
  const status = detail.human_status.trim().toLowerCase();
  if (status === "suppressed") {
    return "The 2023 county Lyme case count is suppressed.";
  }
  if (status === "missing") {
    return "The 2023 county Lyme case count is missing.";
  }
  if (status === "no_county_linked_record") {
    return "No county-linked 2023 Lyme case record is available.";
  }
  if (status === "published_count_floor") {
    return PUBLISHED_CASE_VALUES_UNAVAILABLE;
  }
  return "No county-level 2023 Lyme case count is available.";
}

export function publishedLymeCasePresentation(
  detail: CountyDetail
): PublishedLymeCasePresentation {
  const count = publishedHumanFloorValue(
    detail.human_status,
    detail.case_count_floor_2023
  );
  const rate = publishedHumanFloorValue(
    detail.human_status,
    detail.incidence_floor_2023
  );
  const measures: PublishedLymeCaseMeasure[] = [];
  if (count !== null) {
    measures.push({
      explanation: MINIMUM_REPORTED_CASES_TOOLTIP,
      label: MINIMUM_REPORTED_CASES_LABEL,
      sentence: publishedCaseCountExplanation(count),
    });
  }
  if (rate !== null) {
    measures.push({
      explanation: MINIMUM_REPORTED_INCIDENCE_TOOLTIP,
      label: MINIMUM_REPORTED_INCIDENCE_LABEL,
      sentence: publishedIncidenceExplanation(
        formatPublishedIncidenceRate(rate)
      ),
    });
  }
  if (measures.length === 0) {
    return { measures, text: statusSentence(detail) };
  }
  return {
    measures,
    text: measures
      .map(
        (measure) =>
          `${measure.label}: ${measure.sentence} ${measure.explanation}`
      )
      .join(" "),
  };
}
