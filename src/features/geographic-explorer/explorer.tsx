"use client";

import { useQuery } from "@tanstack/react-query";
import dynamic from "next/dynamic";
import { useQueryStates } from "nuqs";
import { useEffect, useMemo } from "react";

import { AtlasEvidenceSnapshot } from "@/components/atlas-evidence-snapshot";
import { AtlasFilters } from "@/components/atlas-filters";
import { FeedbackTrigger } from "@/components/feedback-dialog";
import { MethodsSection } from "@/components/methods-section";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  metadataV1AtlasMetadataGet,
  scoresV1AtlasScoresGet,
} from "@/generated/atlas";
import {
  FeedbackSubmissionRequestCategory,
  type CountyScoreSummary,
} from "@/generated/models";
import {
  MetadataV1AtlasMetadataGetResponse,
  ScoresV1AtlasScoresGetResponse,
} from "@/generated/zod/atlas";
import { validateApiResponse } from "@/lib/api-response-validation";
import { analyticsControlAttributes } from "@/lib/atlas-analytics";
import { describeReleaseAssembly } from "@/lib/atlas-evidence-metadata";
import { toScoreSettings } from "@/lib/atlas-search-params";
import {
  countyDisplayGeometryQueryKey,
  fetchCountyDisplayGeometry,
} from "@/lib/county-geography";

import {
  CountyComparisons,
  EvidenceTable,
  GeographicGrid,
  RankedDots,
  ScatterPlot,
} from "./charts";
import {
  evidenceLabel,
  explorerParams,
  filteredCountiesCsv,
  metricLabel,
  metricMaximum,
  matchesExplorerEvidence,
  pageOf,
  primaryCountyFips,
  rankCounties,
  VIEW_DESCRIPTIONS,
  VIEW_LABELS,
} from "./model";
import type { Metric } from "./model";
import { GeographicExplorerViewSelector } from "./view-selector";

const ExplorerMaps = dynamic(() => import("./maps"), {
  ssr: false,
  loading: () => <p role="status">Loading map tools…</p>,
});
const EMPTY: CountyScoreSummary[] = [];

export function GeographicExplorer() {
  const [state, setState] = useQueryStates(explorerParams, {
    history: "replace",
    shallow: true,
    scroll: false,
  });
  const settings = toScoreSettings(state);
  const metadata = useQuery({
    queryKey: ["explorer-metadata", state.dataset],
    queryFn: async ({ signal }) =>
      validateApiResponse(
        "Atlas metadata",
        MetadataV1AtlasMetadataGetResponse,
        (
          await metadataV1AtlasMetadataGet(
            { dataset_version: state.dataset ?? undefined },
            { signal }
          )
        ).data
      ),
  });
  const releaseId = metadata.data?.release_id;
  const scores = useQuery({
    queryKey: ["explorer-scores", releaseId, settings],
    enabled: Boolean(releaseId),
    queryFn: async ({ signal }) => {
      const data = validateApiResponse(
        "Atlas scores",
        ScoresV1AtlasScoresGetResponse,
        (
          await scoresV1AtlasScoresGet(
            { dataset_version: releaseId, ...settings },
            { signal }
          )
        ).data
      );
      if (
        data.release_id !== releaseId ||
        data.methodology_version !== metadata.data?.methodology_version
      )
        throw new Error("The score and metadata releases do not match.");
      if (
        data.counties.some(
          (county) =>
            county.evidence_completeness < 0 ||
            county.evidence_completeness > 100
        )
      )
        throw new Error(
          "Evidence completeness is outside its percentage scale."
        );
      return data;
    },
  });
  const needsMap = state.view === "maps" || state.view === "scatter";
  const geometry = useQuery({
    queryKey: countyDisplayGeometryQueryKey("explorer", releaseId),
    enabled: Boolean(releaseId) && needsMap,
    staleTime: Infinity,
    queryFn: ({ signal }) => fetchCountyDisplayGeometry(releaseId!, { signal }),
  });
  const all = scores.data?.counties ?? EMPTY;
  const scope = useMemo(
    () => all.filter((county) => county.in_contiguous_tick_scope),
    [all]
  );
  const availableStates = useMemo(
    () => new Set(scope.map((county) => county.state)),
    [scope]
  );
  const validState =
    state.state === "ALL" || availableStates.has(state.state)
      ? state.state
      : "ALL";
  const matches = useMemo(
    () =>
      scope.filter((county) => {
        const needle = state.q.trim().toLowerCase();
        return (
          (!needle ||
            `${county.county} ${county.state} ${county.fips}`
              .toLowerCase()
              .includes(needle)) &&
          matchesExplorerEvidence(county, state.evidence)
        );
      }),
    [scope, state.q, state.evidence]
  );
  const filtered = useMemo(
    () =>
      matches.filter(
        (county) => validState === "ALL" || county.state === validState
      ),
    [matches, validState]
  );
  const ranked = useMemo(
    () => rankCounties(filtered, state.metric),
    [filtered, state.metric]
  );
  const page = pageOf(ranked, state.page);
  const currentPage = page.current;
  const availableFips = useMemo(
    () => new Set(scope.map((county) => county.fips)),
    [scope]
  );
  const countyUnavailableInRelease =
    /^\d{5}$/.test(state.county) && !availableFips.has(state.county);
  const primaryFips = countyUnavailableInRelease
    ? undefined
    : primaryCountyFips(
        state.view,
        state.selected,
        state.county,
        availableFips
      );
  const selected = countyUnavailableInRelease
    ? undefined
    : (scope.find((county) => county.fips === primaryFips) ?? filtered[0]);
  const selectedFips = countyUnavailableInRelease
    ? state.county
    : (selected?.fips ?? "");
  const comparisons = state.selected.flatMap((fips) => {
    const county = scope.find((item) => item.fips === fips);
    return county ? [county] : [];
  });
  const completenessMaximum = metricMaximum();

  useEffect(() => {
    if (!releaseId || !scores.data) return;
    const validComparisons = state.selected.filter((fips) =>
      availableFips.has(fips)
    );
    if (
      state.dataset !== releaseId ||
      state.state !== validState ||
      state.county !== selectedFips ||
      state.page !== currentPage ||
      validComparisons.join(",") !== state.selected.join(",")
    ) {
      void setState({
        dataset: releaseId,
        state: validState,
        county: selectedFips,
        page: currentPage,
        selected: validComparisons,
      });
    }
  }, [
    releaseId,
    scores.data,
    availableFips,
    validState,
    selectedFips,
    currentPage,
    state.dataset,
    state.state,
    state.county,
    state.page,
    state.selected,
    setState,
  ]);

  if (metadata.isError || scores.isError)
    return (
      <main className="geo-explorer">
        <h1>Geographic explorer is temporarily unavailable</h1>
        <p role="alert">
          The requested release could not be retrieved or verified. Previous
          values are not being shown as current.
        </p>
        <Button
          {...analyticsControlAttributes("geo_retry")}
          onClick={() => {
            void metadata.refetch();
            void scores.refetch();
          }}
        >
          Try again
        </Button>
        {state.dataset && (
          <Button
            {...analyticsControlAttributes("geo_use_current_release")}
            variant="secondary"
            onClick={() => setState({ dataset: null, selected: [] })}
          >
            Use current release
          </Button>
        )}
      </main>
    );
  if (!metadata.data || !scores.data)
    return (
      <main className="geo-explorer">
        <h1>Loading geographic explorer</h1>
        <p role="status">Retrieving the governed county release…</p>
      </main>
    );
  const select = (county: string) => {
    if (state.view === "compare") {
      void setState({
        county,
        selected: [
          county,
          ...state.selected.filter((fips) => fips !== county),
        ].slice(0, 5),
      });
      return;
    }
    void setState({ county });
  };
  const downloadCsv = () => {
    const blob = new Blob([filteredCountiesCsv(ranked)], {
      type: "text/csv;charset=utf-8",
    });
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = objectUrl;
    link.download = `lyme-gap-atlas-counties-${validState.toLowerCase()}.csv`;
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
  };
  const sharedSelection = { selectedFips, onSelect: select };
  const addComparison = () => {
    if (
      selected &&
      !state.selected.includes(selected.fips) &&
      comparisons.length < 5
    )
      void setState({ selected: [...state.selected, selected.fips] });
  };

  return (
    <main className="geo-explorer">
      <header className="geo-header">
        <span className="eyebrow">One Health Lyme Gap Atlas</span>
        <h1>Geographic explorer</h1>
        <p>Different views. The same county evidence.</p>
        <p>
          Explore geographic patterns, inspect missing evidence, and compare
          places before deciding what to investigate.
        </p>
        <FeedbackTrigger
          category={FeedbackSubmissionRequestCategory.data_issue}
          controlId="feedback_report_data_issue"
          label="Report a data issue"
        />
      </header>
      <section id="atlas" aria-label="Geographic exploration workspace">
        <AtlasEvidenceSnapshot layout="banner" metadata={metadata.data} />
        <p className="geo-boundary">
          For surveillance follow-up. Review priority is not a diagnosis, an
          individual disease-risk estimate, or evidence of causation. Missing
          records do not mean zero cases.
        </p>
        <AtlasFilters
          datasetVersion={metadata.data.release_id}
          metadata={metadata.data}
          stateFilter={validState}
          query={state.q}
          evidence={state.evidence}
          onStateChange={(value) => setState({ state: value, page: 1 })}
          onQueryChange={(q) => setState({ q, page: 1 })}
          onEvidenceChange={(evidence) => setState({ evidence, page: 1 })}
          onDownload={downloadCsv}
          settings={settings}
        />
        <GeographicExplorerViewSelector
          activeView={state.view}
          onViewChange={(view) => setState({ view })}
        />
        <div className="geo-workspace">
          <section className="geo-main-panel" aria-labelledby="geo-view-title">
            <div className="geo-panel-heading">
              <div>
                <span className="eyebrow">Explore the evidence</span>
                <h2 id="geo-view-title">{VIEW_LABELS[state.view]}</h2>
                <p
                  className="geo-view-active-description"
                  id="geo-view-description"
                >
                  {VIEW_DESCRIPTIONS[state.view]}
                </p>
              </div>
              <p role="status">{filtered.length} matching counties</p>
            </div>
            {state.view === "tiles" || state.view === "multiples" ? (
              <GeographicGrid
                counties={matches}
                state={validState}
                onState={(value) => setState({ state: value, page: 1 })}
                multiples={state.view === "multiples"}
                maximum={completenessMaximum}
              />
            ) : null}
            {!filtered.length && (
              <p role="status">
                No counties match these filters.{" "}
                <Button
                  {...analyticsControlAttributes("geo_clear_filters")}
                  variant="secondary"
                  onClick={() =>
                    setState({ state: "ALL", q: "", evidence: "all", page: 1 })
                  }
                >
                  Clear filters
                </Button>
              </p>
            )}
            {state.view === "matrix" && (
              <p>
                Read evidence across each county row in the table below. “No
                records” describes published evidence availability, not absence
                of disease.
              </p>
            )}
            {state.view === "ranking" && (
              <>
                <label className="geo-metric">
                  Rank by
                  <Select
                    value={state.metric}
                    onValueChange={(value) => {
                      if (value)
                        void setState({ metric: value as Metric, page: 1 });
                    }}
                  >
                    <SelectTrigger
                      {...analyticsControlAttributes("geo_metric_select")}
                      aria-label="Rank by"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="score">County review score</SelectItem>
                      <SelectItem value="completeness">
                        Evidence completeness
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </label>
                <RankedDots
                  counties={page.items}
                  metric={state.metric}
                  maximum={metricMaximum()}
                  {...sharedSelection}
                />
              </>
            )}
            {needsMap && (
              <div>
                {geometry.isError ? (
                  <p role="alert">
                    County geometry could not be loaded. The table remains
                    available.{" "}
                    <Button
                      {...analyticsControlAttributes("geo_retry_geometry")}
                      variant="secondary"
                      onClick={() => geometry.refetch()}
                    >
                      Retry geometry
                    </Button>
                  </p>
                ) : geometry.data ? (
                  <div
                    className={
                      state.view === "scatter" ? "geo-scatter-layout" : ""
                    }
                  >
                    {state.view === "scatter" && (
                      <ScatterPlot
                        counties={filtered}
                        maximum={completenessMaximum}
                        {...sharedSelection}
                      />
                    )}
                    <ExplorerMaps
                      key={state.view}
                      geometry={geometry.data}
                      counties={filtered}
                      maximum={completenessMaximum}
                      dual={state.view === "maps"}
                      {...sharedSelection}
                    />
                  </div>
                ) : (
                  <p role="status">Loading county geometry…</p>
                )}
              </div>
            )}
            {state.view === "compare" && (
              <CountyComparisons
                counties={comparisons}
                onRemove={(fips) =>
                  setState({
                    selected: state.selected.filter((value) => value !== fips),
                  })
                }
              />
            )}
            {state.view === "trends" && (
              <div className="geo-history-empty">
                <h3>Comparable release history is not available yet</h3>
                <p>
                  The current service exposes one active release. A single
                  snapshot cannot show change over time.
                </p>
                <p>
                  This view needs archived releases, consistent county
                  definitions, and reviewed methodology comparability before
                  timelines can be displayed.
                </p>
                <p>
                  Available snapshot:{" "}
                  {describeReleaseAssembly(metadata.data.release_id)}. Its
                  generation date is a release timestamp, not a disease
                  observation date.
                </p>
              </div>
            )}
          </section>
          <aside className="geo-selection" aria-label="Selected county">
            <span className="eyebrow">Selected county</span>
            {countyUnavailableInRelease ? (
              <>
                <h2>County unavailable in this release</h2>
                <p role="alert">
                  FIPS {state.county} is not available in the active governed
                  release. The URL was kept so this handoff is not mistaken for
                  a different county. Select a county from the evidence table to
                  continue.
                </p>
              </>
            ) : selected ? (
              <>
                <h2>
                  {selected.county}, {selected.state}
                </h2>
                <p>FIPS {selected.fips}</p>
                {!filtered.some((county) => county.fips === selected.fips) && (
                  <p>This selected county is outside the current filters.</p>
                )}
                <strong className="geo-score">
                  {selected.score.score.toFixed(1)}
                  <small> / 100</small>
                </strong>
                <p>County review score · {selected.priority}</p>
                <dl>
                  <dt>Evidence completeness</dt>
                  <dd>{selected.evidence_completeness}%</dd>
                  <dt>Human reporting</dt>
                  <dd>{evidenceLabel(selected.human_status)}</dd>
                  <dt>Tick evidence</dt>
                  <dd>{evidenceLabel(selected.tick_status)}</dd>
                  <dt>Pathogen evidence</dt>
                  <dd>{evidenceLabel(selected.burgdorferi_status)}</dd>
                </dl>
                <Button
                  {...analyticsControlAttributes("geo_add_comparison")}
                  onClick={addComparison}
                  disabled={
                    state.selected.includes(selected.fips) ||
                    comparisons.length >= 5
                  }
                >
                  Add to comparison
                </Button>
                <p>{comparisons.length} of 5 comparison slots used</p>
                <Button
                  {...analyticsControlAttributes("geo_view_comparison")}
                  variant="secondary"
                  onClick={() => setState({ view: "compare" })}
                >
                  View comparison
                </Button>
              </>
            ) : (
              <p>Select a county from the evidence table.</p>
            )}
          </aside>
        </div>
        <section className="geo-results" aria-labelledby="geo-results-title">
          <h2 id="geo-results-title">County evidence table</h2>
          <p>
            Every matching county is available here, sorted by{" "}
            {metricLabel(state.metric).toLowerCase()}. The map and charts use
            this same filtered result set. Geographic grids retain the national
            overview; selecting a tile filters these county results.
          </p>
          <EvidenceTable counties={page.items} {...sharedSelection} />
          <div className="geo-pagination">
            <Button
              {...analyticsControlAttributes("geo_pagination_previous")}
              variant="secondary"
              disabled={currentPage <= 1}
              onClick={() => setState({ page: currentPage - 1 })}
            >
              Previous counties
            </Button>
            <span role="status">
              Page {currentPage} of {page.pages}
            </span>
            <Button
              {...analyticsControlAttributes("geo_pagination_next")}
              variant="secondary"
              disabled={currentPage >= page.pages}
              onClick={() => setState({ page: currentPage + 1 })}
            >
              Next counties
            </Button>
          </div>
        </section>
      </section>
      <section id="scoring" className="geo-scoring">
        <h2>How counties are prioritized</h2>
        <p>
          Scores are supplied by the Python API. Current assumptions: ecological
          share {settings.ecological_share}; low-incidence breakpoint{" "}
          {settings.low_incidence_breakpoint}; missing-human-data weakness{" "}
          {settings.missing_human_weakness}. These settings and the dataset are
          preserved in the page URL.
        </p>
        <p>
          Evidence completeness is the percentage of six scored inputs available
          in this governed release, rounded to a whole percent. It is not a
          confidence interval or measure of evidence quality. The scale stays at
          0–100% across every view and filter. “Most data fields available”
          means at least five of six inputs (83%).
        </p>
      </section>
      <MethodsSection metadata={metadata.data} />
    </main>
  );
}
