"use client";

import { useQuery } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { countyV1CountiesFipsGet, geometryV1AtlasGeometryGet, getRankingCsvV1AtlasRankingCsvGetUrl, metadataV1AtlasMetadataGet, scoresV1AtlasScoresGet } from "@/generated/atlas";
import type { AtlasMetadata, CountyDetail, ScoreCollection } from "@/generated/models";
import { AtlasDashboard } from "@/components/atlas-dashboard";
import { AtlasFilters } from "@/components/atlas-filters";
import { AtlasHero } from "@/components/atlas-hero";
import { CountyProfile } from "@/components/county-profile";
import { MethodsSection } from "@/components/methods-section";
import { ResultsTable } from "@/components/results-table";
import { ScoringLab } from "@/components/scoring-lab";
import { SiteFooter } from "@/components/site-footer";
import { EVIDENCE_VIEWS, type EvidenceView, type ScoreSettings, matchesEvidence, numericParam, reasonsFor } from "@/lib/atlas-ui";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

function useDebounced<T>(value: T, delay = 180) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => { const timer = window.setTimeout(() => setDebounced(value), delay); return () => window.clearTimeout(timer); }, [value, delay]);
  return debounced;
}

function AtlasPage() {
  const params = useSearchParams();
  const router = useRouter();
  const [stateFilter, setStateFilter] = useState(params.get("state") ?? "ALL");
  const [query, setQuery] = useState(params.get("q") ?? "");
  const [evidence, setEvidence] = useState<EvidenceView>(EVIDENCE_VIEWS.has(params.get("evidence") ?? "") ? params.get("evidence") as EvidenceView : "all");
  const [selectedFips, setSelectedFips] = useState(params.get("county")?.match(/^\d{5}$/)?.[0] ?? "06037");
  const [settings, setSettings] = useState<ScoreSettings>({ ecological_share: numericParam(params.get("eco"), 65, 40, 85, 5), low_incidence_breakpoint: numericParam(params.get("breakpoint"), 10, 5, 25), missing_human_weakness: numericParam(params.get("missing"), 75, 40, 90, 5) });
  const [copied, setCopied] = useState(false);
  const [showTable, setShowTable] = useState(false);
  const debouncedSettings = useDebounced(settings);

  const metadataQuery = useQuery({ queryKey: ["metadata"], queryFn: async () => (await metadataV1AtlasMetadataGet()).data as AtlasMetadata });
  const geometryQuery = useQuery({ queryKey: ["geometry", metadataQuery.data?.release_id], enabled: Boolean(metadataQuery.data), queryFn: async () => (await geometryV1AtlasGeometryGet({ dataset_version: metadataQuery.data!.release_id })).data as GeoJSON.FeatureCollection, staleTime: Infinity });
  const scoresQuery = useQuery({ queryKey: ["scores", metadataQuery.data?.release_id, debouncedSettings], enabled: Boolean(metadataQuery.data), placeholderData: (previous) => previous, queryFn: async () => (await scoresV1AtlasScoresGet({ dataset_version: metadataQuery.data!.release_id, ...debouncedSettings })).data as ScoreCollection });
  const detailQuery = useQuery({ queryKey: ["county", selectedFips, metadataQuery.data?.release_id, debouncedSettings], enabled: Boolean(metadataQuery.data && selectedFips), placeholderData: (previous) => previous, queryFn: async () => (await countyV1CountiesFipsGet(selectedFips, { dataset_version: metadataQuery.data!.release_id, ...debouncedSettings })).data as CountyDetail });

  const filtered = useMemo(() => (scoresQuery.data?.counties ?? []).filter((county) => {
    const needle = query.trim().toLowerCase();
    return county.in_contiguous_tick_scope && (stateFilter === "ALL" || county.state === stateFilter) && (!needle || `${county.county} ${county.state} ${county.fips}`.toLowerCase().includes(needle)) && matchesEvidence(county, evidence);
  }), [scoresQuery.data, stateFilter, query, evidence]);

  useEffect(() => {
    const next = new URLSearchParams();
    if (metadataQuery.data?.release_id) next.set("dataset", metadataQuery.data.release_id);
    if (stateFilter !== "ALL") next.set("state", stateFilter);
    if (query) next.set("q", query);
    if (evidence !== "all") next.set("evidence", evidence);
    next.set("county", selectedFips); next.set("eco", String(settings.ecological_share)); next.set("breakpoint", String(settings.low_incidence_breakpoint)); next.set("missing", String(settings.missing_human_weakness));
    router.replace(`/?${next.toString()}`, { scroll: false });
  }, [metadataQuery.data?.release_id, stateFilter, query, evidence, selectedFips, settings, router]);

  async function copyBriefing() {
    if (!detailQuery.data) return;
    const detail = detailQuery.data;
    const narrative = `${detail.county} County, ${detail.state_name} has a County Review Priority of ${detail.score.score}. ${reasonsFor(detail).join(" ")} This summary supports follow-up review; it is not an individual-risk or causal finding.`;
    try { await navigator.clipboard.writeText(narrative); setCopied(true); window.setTimeout(() => setCopied(false), 2_000); } catch { setCopied(false); }
  }

  function downloadCsv() {
    const url = getRankingCsvV1AtlasRankingCsvGetUrl({ state: stateFilter, q: query, evidence, ...debouncedSettings });
    const link = document.createElement("a"); link.href = `${API_BASE_URL}${url}`; link.download = "lyme-gap-atlas-ranking.csv"; link.click();
  }

  if (metadataQuery.isPending) return <main className="load-state"><div><div className="loading-mark" aria-hidden="true"><span /><span /><span /></div><h1>Loading the Atlas</h1><p>Retrieving the governed county release through the public API.</p></div></main>;
  if (metadataQuery.error || geometryQuery.error || scoresQuery.error || !metadataQuery.data) return <main className="load-state"><div><h1>The Atlas is temporarily unavailable</h1><p>Unable to retrieve the current governed release.</p><button className="button primary" onClick={() => location.reload()}>Try again</button></div></main>;

  const metadata = metadataQuery.data;
  return <main><AtlasHero /><section className="stat-strip" aria-label="Atlas summary"><div><strong>3,144</strong><span>County and county-equivalent profiles</span></div><div><strong>5</strong><span>Public One Health signal groups</span></div><div><strong>2022–25</strong><span>Source vintages in this Alpha release</span></div><div><strong>v0.2.0</strong><span>Transparent deterministic methodology</span></div></section><section className="atlas-shell section" id="atlas"><div className="section-heading"><div><span className="eyebrow">Interactive county atlas</span><h2>Where should surveillance partners look next?</h2><p>Filter the ranked counties, select a place, and review the evidence before taking action.</p></div><div className="data-stamp"><span><i className="pulse" />Current governed snapshot</span><small>{metadata.release_id} · {metadata.methodology_version}</small></div></div><AtlasFilters metadata={metadata} stateFilter={stateFilter} query={query} evidence={evidence} onStateChange={setStateFilter} onQueryChange={setQuery} onEvidenceChange={setEvidence} onDownload={downloadCsv} /><AtlasDashboard geometry={geometryQuery.data} scores={scoresQuery.data?.counties} counties={filtered} selectedFips={selectedFips} selectedState={stateFilter} showTable={showTable} onSelect={setSelectedFips} onToggleTable={() => setShowTable((open) => !open)} />{detailQuery.data && <CountyProfile detail={detailQuery.data} copied={copied} onCopy={copyBriefing} />}{showTable && <ResultsTable counties={filtered} onSelect={(fips) => { setSelectedFips(fips); document.getElementById("atlas")?.scrollIntoView(); }} />}<p className="sr-status" aria-live="polite">{scoresQuery.isFetching ? "Updating county scores." : `${filtered.length} counties match the current filters.`}</p></section><ScoringLab settings={settings} onChange={setSettings} /><MethodsSection metadata={metadata} /><SiteFooter /></main>;
}

export default function Page() { return <Suspense fallback={<main className="load-state"><h1>Loading the Atlas</h1></main>}><AtlasPage /></Suspense>; }
