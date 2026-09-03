"use client";

import { useQuery } from "@tanstack/react-query";
import { useQueryStates } from "nuqs";
import { Suspense, useEffect, useMemo, useState } from "react";

import { AtlasDashboard } from "@/components/atlas-dashboard";
import { AtlasFilters } from "@/components/atlas-filters";
import { AtlasHero } from "@/components/atlas-hero";
import { MethodsSection } from "@/components/methods-section";
import { ResultsTable } from "@/components/results-table";
import { ScoringLab } from "@/components/scoring-lab";
import { SiteFooter } from "@/components/site-footer";
import { Button } from "@/components/ui/button";
import {
  countyV1CountiesFipsGet,
  geometryV1AtlasGeometryGet,
  getRankingCsvV1AtlasRankingCsvGetUrl,
  metadataV1AtlasMetadataGet,
  scoresV1AtlasScoresGet,
} from "@/generated/atlas";
import {
  CountyV1CountiesFipsGetResponse,
  MetadataV1AtlasMetadataGetResponse,
  ScoresV1AtlasScoresGetResponse,
} from "@/generated/zod/atlas";
import { validateApiResponse } from "@/lib/api-response-validation";
import {
  atlasSearchParams,
  synchronizeGovernedDataset,
  toScoreSettings,
} from "@/lib/atlas-search-params";
import { matchesEvidence, reasonsFor } from "@/lib/atlas-ui";
import type { EvidenceView, ScoreSettings } from "@/lib/atlas-ui";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

function useDebounced<T>(value: T, delay = 180) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

function AtlasPage() {
  const [urlState, setUrlState] = useQueryStates(atlasSearchParams, {
    history: "replace",
    scroll: false,
    shallow: true,
  });
  const {
    county: selectedFips,
    evidence,
    q: query,
    state: stateFilter,
  } = urlState;
  const settings = toScoreSettings(urlState);
  const setStateFilter = (state: string) => setUrlState({ state });
  const setQuery = (q: string) => setUrlState({ q });
  const setEvidence = (evidence: EvidenceView) => setUrlState({ evidence });
  const setSelectedFips = (county: string) => setUrlState({ county });
  const setSettings = (next: ScoreSettings) =>
    setUrlState({
      breakpoint: next.low_incidence_breakpoint,
      eco: next.ecological_share,
      missing: next.missing_human_weakness,
    });
  const [copied, setCopied] = useState(false);
  const [showTable, setShowTable] = useState(false);
  const debouncedSettings = useDebounced(settings);

  const metadataQuery = useQuery({
    queryFn: async () =>
      validateApiResponse(
        "Atlas metadata",
        MetadataV1AtlasMetadataGetResponse,
        (await metadataV1AtlasMetadataGet()).data
      ),
    queryKey: ["metadata"],
  });
  const geometryQuery = useQuery({
    enabled: Boolean(metadataQuery.data),
    queryFn: async () =>
      (
        await geometryV1AtlasGeometryGet({
          dataset_version: metadataQuery.data!.release_id,
        })
      ).data as GeoJSON.FeatureCollection,
    queryKey: ["geometry", metadataQuery.data?.release_id],
    staleTime: Infinity,
  });
  const scoresQuery = useQuery({
    enabled: Boolean(metadataQuery.data),
    placeholderData: (previous) => previous,
    queryFn: async () =>
      validateApiResponse(
        "Atlas scores",
        ScoresV1AtlasScoresGetResponse,
        (
          await scoresV1AtlasScoresGet({
            dataset_version: metadataQuery.data!.release_id,
            ...debouncedSettings,
          })
        ).data
      ),
    queryKey: ["scores", metadataQuery.data?.release_id, debouncedSettings],
  });
  const detailQuery = useQuery({
    enabled: Boolean(metadataQuery.data && selectedFips),
    placeholderData: (previous) => previous,
    queryFn: async () =>
      validateApiResponse(
        "County detail",
        CountyV1CountiesFipsGetResponse,
        (
          await countyV1CountiesFipsGet(selectedFips, {
            dataset_version: metadataQuery.data!.release_id,
            ...debouncedSettings,
          })
        ).data
      ),
    queryKey: [
      "county",
      selectedFips,
      metadataQuery.data?.release_id,
      debouncedSettings,
    ],
  });

  const filtered = useMemo(
    () =>
      (scoresQuery.data?.counties ?? []).filter((county) => {
        const needle = query.trim().toLowerCase();
        return (
          county.in_contiguous_tick_scope &&
          (stateFilter === "ALL" || county.state === stateFilter) &&
          (!needle ||
            `${county.county} ${county.state} ${county.fips}`
              .toLowerCase()
              .includes(needle)) &&
          matchesEvidence(county, evidence)
        );
      }),
    [scoresQuery.data, stateFilter, query, evidence]
  );

  useEffect(() => {
    if (metadataQuery.data?.release_id) {
      synchronizeGovernedDataset(metadataQuery.data.release_id);
    }
  }, [metadataQuery.data?.release_id]);

  async function copyBriefing() {
    if (!detailQuery.data) {
      return;
    }
    const detail = detailQuery.data;
    const narrative = `${detail.county} County, ${detail.state_name} has a County Review Priority of ${detail.score.score}. ${reasonsFor(detail).join(" ")} This summary supports follow-up review; it is not an individual-risk or causal finding.`;
    try {
      await navigator.clipboard.writeText(narrative);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  function downloadCsv() {
    const url = getRankingCsvV1AtlasRankingCsvGetUrl({
      evidence,
      q: query,
      state: stateFilter,
      ...debouncedSettings,
    });
    const link = document.createElement("a");
    link.href = `${API_BASE_URL}${url}`;
    link.download = "lyme-gap-atlas-ranking.csv";
    link.click();
  }

  if (metadataQuery.isPending) {
    return (
      <main className="load-state">
        <div>
          <div className="loading-mark" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
          <h1>Loading the Atlas</h1>
          <p>Retrieving the governed county release through the public API.</p>
        </div>
      </main>
    );
  }
  if (
    metadataQuery.error ||
    geometryQuery.error ||
    scoresQuery.error ||
    !metadataQuery.data
  ) {
    return (
      <main className="load-state">
        <div>
          <h1>The Atlas is temporarily unavailable</h1>
          <p>Unable to retrieve the current governed release.</p>
          <Button onClick={() => location.reload()}>Try again</Button>
        </div>
      </main>
    );
  }

  const metadata = metadataQuery.data;
  const selectedCountyState = scoresQuery.data?.counties.find(
    (county) => county.fips === selectedFips
  )?.state;
  return (
    <main>
      <AtlasHero />
      <section className="stat-strip" aria-label="Atlas summary">
        <div>
          <strong>3,144</strong>
          <span>County and county-equivalent profiles</span>
        </div>
        <div>
          <strong>5</strong>
          <span>Public One Health signal groups</span>
        </div>
        <div>
          <strong>2022–25</strong>
          <span>Source vintages in this Alpha release</span>
        </div>
        <div>
          <strong>v0.2.0</strong>
          <span>Transparent deterministic methodology</span>
        </div>
      </section>
      <section className="atlas-shell section" id="atlas">
        <div className="section-heading">
          <div>
            <span className="eyebrow">Interactive county atlas</span>
            <h2>Where should surveillance partners look next?</h2>
            <p>
              Filter the ranked counties, select a place, and review the
              evidence before taking action.
            </p>
          </div>
          <div className="data-stamp">
            <span>
              <i className="pulse" />
              Current governed snapshot
            </span>
            <small>
              {metadata.release_id} · {metadata.methodology_version}
            </small>
          </div>
        </div>
        <AtlasFilters
          metadata={metadata}
          stateFilter={stateFilter}
          query={query}
          evidence={evidence}
          onStateChange={setStateFilter}
          onQueryChange={setQuery}
          onEvidenceChange={setEvidence}
          onDownload={downloadCsv}
        />
        <AtlasDashboard
          geometry={geometryQuery.data}
          scores={scoresQuery.data?.counties}
          counties={filtered}
          detail={detailQuery.data}
          copied={copied}
          onCopy={copyBriefing}
          selectedFips={selectedFips}
          selectedState={stateFilter}
          highlightState={selectedCountyState}
          showTable={showTable}
          onSelect={setSelectedFips}
          onToggleTable={() => setShowTable((open) => !open)}
        />
        {showTable && (
          <ResultsTable
            counties={filtered}
            onSelect={(fips) => {
              setSelectedFips(fips);
              document.querySelector("#atlas")?.scrollIntoView();
            }}
          />
        )}
        <p className="sr-status" aria-live="polite">
          {scoresQuery.isFetching
            ? "Updating county scores."
            : `${filtered.length} counties match the current filters.`}
        </p>
      </section>
      <ScoringLab settings={settings} onChange={setSettings} />
      <MethodsSection metadata={metadata} />
      <SiteFooter />
    </main>
  );
}

export default function Page() {
  return (
    <Suspense
      fallback={
        <main className="load-state">
          <h1>Loading the Atlas</h1>
        </main>
      }
    >
      <AtlasPage />
    </Suspense>
  );
}
