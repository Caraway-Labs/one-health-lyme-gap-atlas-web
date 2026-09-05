"use client";

import { useQuery } from "@tanstack/react-query";
import dynamic from "next/dynamic";
import { useQueryStates } from "nuqs";
import { useEffect, useMemo } from "react";

import { AtlasFilters } from "@/components/atlas-filters";
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
  geometryV1AtlasGeometryGet,
  metadataV1AtlasMetadataGet,
  scoresV1AtlasScoresGet,
} from "@/generated/atlas";
import type { CountyScoreSummary } from "@/generated/models";
import {
  MetadataV1AtlasMetadataGetResponse,
  ScoresV1AtlasScoresGetResponse,
} from "@/generated/zod/atlas";
import { validateApiResponse } from "@/lib/api-response-validation";
import { toScoreSettings } from "@/lib/atlas-search-params";

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
  metricLabel,
  metricMaximum,
  matchesExplorerEvidence,
  pageOf,
  rankCounties,
  VIEW_LABELS,
  VIEWS,
} from "./model";
import type { Metric } from "./model";

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
    queryKey: ["explorer-geometry", releaseId],
    enabled: Boolean(releaseId) && needsMap,
    staleTime: Infinity,
    queryFn: async ({ signal }) => {
      const data = (
        await geometryV1AtlasGeometryGet(
          { dataset_version: releaseId },
          { signal }
        )
      ).data;
      if (
        !data ||
        typeof data !== "object" ||
        !("type" in data) ||
        data.type !== "FeatureCollection" ||
        !("features" in data) ||
        !Array.isArray(data.features)
      )
        throw new Error("County geometry is unavailable.");
      return data as unknown as GeoJSON.FeatureCollection;
    },
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
  const selected =
    scope.find((county) => county.fips === state.county) ?? filtered[0];
  const selectedFips = selected?.fips ?? "";
  const comparisons = state.selected.flatMap((fips) => {
    const county = scope.find((item) => item.fips === fips);
    return county ? [county] : [];
  });
  const completenessMaximum = metricMaximum();

  useEffect(() => {
    if (!releaseId || !scores.data) return;
    const validComparisons = state.selected.filter((fips) =>
      scope.some((county) => county.fips === fips)
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
    scope,
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
          onClick={() => {
            void metadata.refetch();
            void scores.refetch();
          }}
        >
          Try again
        </Button>
        {state.dataset && (
          <Button
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
    void setState({ county });
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
        <span className="eyebrow">One Health Lyme Gap Atlas / Variant 7</span>
        <h1>Geographic explorer</h1>
        <p>Different views. The same county evidence.</p>
        <p>
          Explore geographic patterns, inspect missing evidence, and compare
          places before deciding what to investigate.
        </p>
      </header>
      <section id="atlas" aria-label="Geographic exploration workspace">
        <div className="geo-release">
          <strong>Release {releaseId}</strong>
          <span>Method {metadata.data.methodology_version}</span>
          <span>Scope: contiguous U.S. counties included in this release</span>
          <span>
            Generated {metadata.data.generated_at} · Loaded{" "}
            {metadata.data.loaded_at}
          </span>
        </div>
        <p className="geo-boundary">
          For surveillance follow-up. Review priority is not a diagnosis, an
          individual disease-risk estimate, or evidence of causation. Missing
          records do not mean zero cases.
        </p>
        <AtlasFilters
          metadata={metadata.data}
          stateFilter={validState}
          query={state.q}
          evidence={state.evidence}
          onStateChange={(value) => setState({ state: value, page: 1 })}
          onQueryChange={(q) => setState({ q, page: 1 })}
          onEvidenceChange={(evidence) => setState({ evidence, page: 1 })}
        />
        <div
          className="geo-view-switch"
          role="group"
          aria-label="Visualization views"
        >
          {VIEWS.map((view) => (
            <Button
              key={view}
              className={view === state.view ? "hover:bg-primary" : undefined}
              variant={view === state.view ? "default" : "secondary"}
              aria-pressed={view === state.view}
              onClick={() => setState({ view })}
            >
              {VIEW_LABELS[view]}
            </Button>
          ))}
        </div>
        <div className="geo-workspace">
          <section className="geo-main-panel" aria-labelledby="geo-view-title">
            <div className="geo-panel-heading">
              <div>
                <span className="eyebrow">Explore the evidence</span>
                <h2 id="geo-view-title">{VIEW_LABELS[state.view]}</h2>
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
                    <SelectTrigger aria-label="Rank by">
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
                  Available snapshot: <strong>{releaseId}</strong>. Its
                  generation date is a release timestamp, not a disease
                  observation date.
                </p>
              </div>
            )}
          </section>
          <aside className="geo-selection" aria-label="Selected county">
            <span className="eyebrow">Selected county</span>
            {selected ? (
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
          in this Alpha release, rounded to a whole percent. It is not a
          confidence interval or measure of evidence quality. The scale stays at
          0–100% across every view and filter. “Most data fields available”
          means at least five of six inputs (83%).
        </p>
      </section>
      <MethodsSection metadata={metadata.data} />
    </main>
  );
}
