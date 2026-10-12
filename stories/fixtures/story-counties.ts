import type {
  AtlasMetadata,
  CountyDetail,
  CountyScoreSummary,
  Score,
} from "@/generated/models";

const storyScore = (score: number): Score => ({
  score,
  human_weakness: 22,
  ecological: 31,
  community: 14,
  tick_signal: 40,
  pathogen_signal: 18,
  svi_signal: 27,
  access_signal: 11,
  rural_signal: 9,
});

export const storyRelease: AtlasMetadata = {
  release_id: "alpha-2026",
  schema_version: "story",
  generated_at: "2026-10-06T04:57:46.000Z",
  loaded_at: "2026-10-06T04:57:46.000Z",
  scope: "lower-48-dc",
  bundle_sha256: "story",
  score_defaults: {},
  methodology_version: "story-method",
  limitations:
    "Synthetic release limitation for this preview. This is not a live county result.",
  sources: [
    {
      key: "cdc",
      label: "Published surveillance",
      vintage: "2023",
      url: "#synthetic-source",
      note: "Synthetic source note. This preview does not request it.",
    },
  ],
  states: [],
};

export const storyReleaseMissing: AtlasMetadata = {
  ...storyRelease,
  release_id: "",
  generated_at: "",
  loaded_at: "",
  methodology_version: "",
  limitations: "",
  sources: [],
};

type SummaryInput = {
  fips: string;
  county: string;
  state: string;
  stateName: string;
  priority: string;
  color: string;
  score: number;
  completeness: number;
  humanStatus?: string;
  tickStatus?: string;
  pathogenStatus?: string;
};

function summary(input: SummaryInput): CountyScoreSummary {
  return {
    fips: input.fips,
    county: input.county,
    state: input.state,
    state_name: input.stateName,
    in_contiguous_tick_scope: true,
    human_status: input.humanStatus ?? "published_count_floor",
    tick_status: input.tickStatus ?? "Established",
    burgdorferi_status: input.pathogenStatus ?? "Present",
    evidence_completeness: input.completeness,
    score: storyScore(input.score),
    priority: input.priority,
    color: input.color,
  };
}

export const adamsCounty = summary({
  fips: "08001",
  county: "Adams County",
  state: "CO",
  stateName: "Colorado",
  priority: "Priority 1 — review first",
  color: "#e9602b",
  score: 72,
  completeness: 83,
});

export const boulderCounty = summary({
  fips: "08013",
  county: "Boulder County",
  state: "CO",
  stateName: "Colorado",
  priority: "Priority 2 — review",
  color: "#55a8a3",
  score: 41,
  completeness: 50,
});

export const wakeCounty = summary({
  fips: "37183",
  county: "Wake County",
  state: "NC",
  stateName: "North Carolina",
  priority: "Watch",
  color: "#87b982",
  score: 28,
  completeness: 50,
});

export const districtCounty = summary({
  fips: "11001",
  county: "District of Columbia",
  state: "DC",
  stateName: "District of Columbia",
  priority: "Lower review priority",
  color: "#a9d2db",
  score: 12,
  completeness: 66,
});

export const longNameCounty = summary({
  fips: "36061",
  county: "Synthetic county with a long display name for overflow",
  state: "NY",
  stateName: "New York",
  priority: "Priority 2 — review",
  color: "#efc64a",
  score: 55,
  completeness: 70,
});

/** Forty-one Colorado FIPS values so the shortlist stops at forty. */
export function storyRankedCounties(count: number): CountyScoreSummary[] {
  return Array.from({ length: count }, (_, index) =>
    summary({
      fips: `08${String(index + 1).padStart(3, "0")}`,
      county: `Synthetic county ${index + 1}`,
      state: "CO",
      stateName: "Colorado",
      priority:
        index === 0 ? "Priority 1 — review first" : "Priority 2 — review",
      color: index === 0 ? "#e9602b" : "#55a8a3",
      score: 80 - index,
      completeness: 40 + (index % 20),
    })
  );
}

export const storyChartCounties = [adamsCounty, boulderCounty, wakeCounty];

function detailFrom(
  county: CountyScoreSummary,
  extra: {
    cases: number | null;
    incidence: number | null;
    population: number | null;
    rucc: number | null;
    svi: number | null;
    unallocated: number | null;
    uninsuredPercent: number | null;
    release?: AtlasMetadata;
  }
): CountyDetail {
  return {
    ...county,
    population: extra.population,
    case_count_floor_2023: extra.cases,
    incidence_floor_2023: extra.incidence,
    state_unallocated_records_2023: extra.unallocated,
    scapularis_status:
      county.tick_status === "No records" ? "No records" : "Established",
    pacificus_status: "No records",
    svi_percentile: extra.svi,
    uninsured_percentile: extra.uninsuredPercent,
    uninsured_percent: extra.uninsuredPercent,
    rucc_2023: extra.rucc,
    release: extra.release ?? storyRelease,
  };
}

export const publishedCounty = detailFrom(adamsCounty, {
  cases: 12,
  incidence: 4.2,
  unallocated: 0,
  population: 520_000,
  svi: 0.42,
  uninsuredPercent: 8,
  rucc: 1,
});

export const publishedZeroCounty = detailFrom(
  { ...boulderCounty, evidence_completeness: 100 },
  {
    cases: 0,
    incidence: 0,
    unallocated: 0,
    population: 330_000,
    svi: 0.2,
    uninsuredPercent: 6,
    rucc: 2,
  }
);

export const missingCounty = detailFrom(
  summary({
    fips: "37183",
    county: "Wake County",
    state: "NC",
    stateName: "North Carolina",
    priority: "Priority 1 — review first",
    color: "#f49a32",
    score: 64,
    completeness: 33,
    humanStatus: "not_published",
    tickStatus: "No records",
    pathogenStatus: "No records",
  }),
  {
    cases: null,
    incidence: null,
    unallocated: 3,
    population: null,
    svi: null,
    uninsuredPercent: null,
    rucc: null,
  }
);
