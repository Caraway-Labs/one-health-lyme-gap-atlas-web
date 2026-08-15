"use client";

import { useQuery } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import {
  countyV1CountiesFipsGet,
  geometryV1AtlasGeometryGet,
  getRankingCsvV1AtlasRankingCsvGetUrl,
  metadataV1AtlasMetadataGet,
  scoresV1AtlasScoresGet,
} from "@/generated/atlas";
import type {
  AtlasMetadata,
  CountyDetail,
  CountyScoreSummary,
  ScoreCollection,
} from "@/generated/models";
import { AtlasMap } from "@/components/atlas-map";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";
const EVIDENCE = new Set(["all", "ecological", "human", "complete"]);

type Settings = {
  ecological_share: number;
  low_incidence_breakpoint: number;
  missing_human_weakness: number;
};

function numericParam(value: string | null, fallback: number, min: number, max: number, step = 1) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= min && parsed <= max && parsed % step === 0
    ? parsed
    : fallback;
}

function useDebounced<T>(value: T, delay = 180) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

function reasonsFor(county: CountyDetail): string[] {
  return [
    county.human_status === "published_count_floor"
      ? `The published county-linked human incidence floor is ${county.incidence_floor_2023?.toFixed(1) ?? "unavailable"} per 100,000.`
      : "No publishable county-linked human record is available; the score treats missingness explicitly, not as zero cases.",
    county.tick_status === "No records"
      ? "The published tick table has no county record; this does not establish tick absence."
      : `Ixodes evidence is classified as ${county.tick_status.toLowerCase()} in the published county table.`,
    county.burgdorferi_status === "Present"
      ? "B. burgdorferi was identified in at least one host-seeking Ixodes tick."
      : "The published pathogen table has no county record; this does not establish pathogen absence.",
  ];
}

function matchesEvidence(county: CountyScoreSummary, evidence: string) {
  if (evidence === "ecological") return county.tick_status !== "No records" || county.burgdorferi_status === "Present";
  if (evidence === "human") return county.human_status === "published_count_floor";
  if (evidence === "complete") return county.evidence_completeness >= 5;
  return true;
}

function AtlasPage() {
  const params = useSearchParams();
  const router = useRouter();
  const [stateFilter, setStateFilter] = useState(params.get("state") ?? "ALL");
  const [query, setQuery] = useState(params.get("q") ?? "");
  const [evidence, setEvidence] = useState(EVIDENCE.has(params.get("evidence") ?? "") ? params.get("evidence")! : "all");
  const [selectedFips, setSelectedFips] = useState(params.get("county")?.match(/^\d{5}$/)?.[0] ?? "06037");
  const [settings, setSettings] = useState<Settings>({
    ecological_share: numericParam(params.get("eco"), 65, 40, 85, 5),
    low_incidence_breakpoint: numericParam(params.get("breakpoint"), 10, 5, 25),
    missing_human_weakness: numericParam(params.get("missing"), 75, 40, 90, 5),
  });
  const [copied, setCopied] = useState(false);
  const [showTable, setShowTable] = useState(false);
  const debouncedSettings = useDebounced(settings);

  const metadataQuery = useQuery({
    queryKey: ["metadata"],
    queryFn: async () => (await metadataV1AtlasMetadataGet()).data as AtlasMetadata,
  });
  const geometryQuery = useQuery({
    queryKey: ["geometry", metadataQuery.data?.release_id],
    enabled: Boolean(metadataQuery.data),
    queryFn: async () => (await geometryV1AtlasGeometryGet({ dataset_version: metadataQuery.data!.release_id })).data as GeoJSON.FeatureCollection,
    staleTime: Infinity,
  });
  const scoresQuery = useQuery({
    queryKey: ["scores", metadataQuery.data?.release_id, debouncedSettings],
    enabled: Boolean(metadataQuery.data),
    placeholderData: (previous) => previous,
    queryFn: async () => (await scoresV1AtlasScoresGet({ dataset_version: metadataQuery.data!.release_id, ...debouncedSettings })).data as ScoreCollection,
  });
  const detailQuery = useQuery({
    queryKey: ["county", selectedFips, metadataQuery.data?.release_id, debouncedSettings],
    enabled: Boolean(metadataQuery.data && selectedFips),
    placeholderData: (previous) => previous,
    queryFn: async () => (await countyV1CountiesFipsGet(selectedFips, { dataset_version: metadataQuery.data!.release_id, ...debouncedSettings })).data as CountyDetail,
  });

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return (scoresQuery.data?.counties ?? []).filter((county) => {
      if (!county.in_contiguous_tick_scope) return false;
      if (stateFilter !== "ALL" && county.state !== stateFilter) return false;
      if (needle && !`${county.county} ${county.state} ${county.fips}`.toLowerCase().includes(needle)) return false;
      return matchesEvidence(county, evidence);
    });
  }, [scoresQuery.data, stateFilter, query, evidence]);

  useEffect(() => {
    const next = new URLSearchParams();
    if (metadataQuery.data?.release_id) next.set("dataset", metadataQuery.data.release_id);
    if (stateFilter !== "ALL") next.set("state", stateFilter);
    if (query) next.set("q", query);
    if (evidence !== "all") next.set("evidence", evidence);
    next.set("county", selectedFips);
    next.set("eco", String(settings.ecological_share));
    next.set("breakpoint", String(settings.low_incidence_breakpoint));
    next.set("missing", String(settings.missing_human_weakness));
    router.replace(`/?${next.toString()}`, { scroll: false });
  }, [metadataQuery.data?.release_id, stateFilter, query, evidence, selectedFips, settings, router]);

  const detail = detailQuery.data;
  const failed = metadataQuery.error || geometryQuery.error || scoresQuery.error;

  async function copyBriefing() {
    if (!detail) return;
    const narrative = `${detail.county} County, ${detail.state_name} has a Surveillance Gap Score of ${detail.score.score}. ${reasonsFor(detail).join(" ")} This is a population-level hypothesis for follow-up, not an individual-risk or causal finding.`;
    try {
      await navigator.clipboard.writeText(narrative);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2_000);
    } catch {
      setCopied(false);
    }
  }

  function downloadCsv() {
    const url = getRankingCsvV1AtlasRankingCsvGetUrl({ state: stateFilter, q: query, evidence: evidence as "all", ...debouncedSettings });
    const link = document.createElement("a");
    link.href = `${API_BASE_URL}${url}`;
    link.download = "lyme-gap-atlas-ranking.csv";
    link.click();
  }

  if (metadataQuery.isPending) {
    return <main className="load-state"><div><div className="loading-mark" aria-hidden="true"><span/><span/><span/></div><h1>Loading the Atlas</h1><p>Retrieving the governed county release through the public API.</p></div></main>;
  }
  if (failed || !metadataQuery.data) {
    return <main className="load-state"><div><h1>The Atlas is temporarily unavailable</h1><p>{failed instanceof Error ? failed.message : "The data service did not return a release."}</p><button className="button primary" onClick={() => location.reload()}>Try again</button></div></main>;
  }

  const metadata = metadataQuery.data;
  return (
    <main>
      <header className="hero">
        <nav className="topbar" aria-label="Main navigation">
          <a className="brand" href="#atlas" aria-label="One Health Lyme Gap Atlas home"><span className="brand-mark">+</span><span>One Health<br/>Lyme Gap Atlas</span></a>
          <div className="nav-links"><a href="#atlas">Atlas</a><a href="#scoring">Scoring lab</a><a href="#methods">Data & methods</a></div>
        </nav>
        <div className="hero-content">
          <div><span className="eyebrow light">Population-level decision support</span><h1>Find the places where Lyme surveillance signals may be out of step.</h1><p>Join ecological evidence, community barriers, and published human surveillance floors to identify counties that merit additional review.</p><div className="hero-actions"><a className="button primary" href="#atlas">Explore the Atlas</a><a className="button ghost" href="#methods">Read the guardrails</a></div></div>
          <aside className="hero-note"><span className="note-icon">i</span><div><strong>A hypothesis generator—not a risk map</strong><p>The Atlas does not diagnose patients, locate exposure, estimate true incidence, or imply that a lower score means an individual is safe.</p></div></aside>
        </div>
      </header>

      <section className="stat-strip" aria-label="Atlas summary">
        <div><strong>3,144</strong><span>County and county-equivalent profiles</span></div>
        <div><strong>5</strong><span>Public One Health signal groups</span></div>
        <div><strong>2022–25</strong><span>Source vintages in this Alpha release</span></div>
        <div><strong>v0.2.0</strong><span>Transparent deterministic methodology</span></div>
      </section>

      <section className="atlas-shell section" id="atlas">
        <div className="section-heading"><div><span className="eyebrow">Interactive county atlas</span><h2>Where should surveillance partners look next?</h2><p>Filter the ranked counties, select a place, and review the evidence before taking action.</p></div><div className="data-stamp"><span><i className="pulse"/>Current governed snapshot</span><small>{metadata.release_id} · {metadata.methodology_version}</small></div></div>
        <div className="filter-bar">
          <label><span>State</span><select aria-label="State" value={stateFilter} onChange={(event) => setStateFilter(event.target.value)}><option value="ALL">All states</option>{metadata.states.map((state) => <option value={state.code} key={state.code}>{state.name}</option>)}</select></label>
          <label><span>County or FIPS</span><input aria-label="County or FIPS" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search counties…"/></label>
          <label><span>Evidence view</span><select aria-label="Evidence view" value={evidence} onChange={(event) => setEvidence(event.target.value)}><option value="all">All scorable counties</option><option value="ecological">Ecological evidence present</option><option value="human">Published human signal present</option><option value="complete">Five to six inputs available</option></select></label>
          <button className="button export" onClick={downloadCsv}>Download ranking CSV</button>
        </div>

        <div className="dashboard-grid">
          <article className="card map-card"><div className="card-title-row"><div><span className="eyebrow">Surveillance Gap Score</span><h3>County pattern</h3></div><span className="map-scope">Contiguous U.S. scored scope</span></div><div className="map-wrap">{geometryQuery.data && scoresQuery.data ? <AtlasMap geometry={geometryQuery.data as never} scores={scoresQuery.data.counties} selectedFips={selectedFips} onSelect={setSelectedFips}/> : <div className="map-loading">Loading map…</div>}</div><div className="legend" aria-label="Map score legend"><span>Lower</span><span className="legend-ramp"><i/><i/><i/><i/><i/><i/></span><span>Higher</span><small>Gray counties are outside the scored comparison.</small></div></article>
          <aside className="card rank-card"><div className="card-title-row compact"><div><span className="eyebrow">Ranked results</span><h3>Counties to review</h3></div><span className="result-count">{filtered.length}</span></div><div className="rank-list" role="list" aria-label="Ranked counties">{filtered.slice(0, 40).map((county, index) => <div role="listitem" key={county.fips}><button type="button" className={`rank-row ${county.fips === selectedFips ? "active" : ""}`} onClick={() => setSelectedFips(county.fips)}><span className="rank-number">{index + 1}</span><span className="rank-name"><strong>{county.county}, {county.state}</strong><small>FIPS {county.fips} · {county.priority}</small></span><span className="rank-score" style={{background: county.color}}>{county.score.score}</span></button></div>)}</div><p className="list-note">Showing the first 40 filtered counties. The accessible table and CSV include the complete result.</p><button className="table-toggle" onClick={() => setShowTable(!showTable)} aria-expanded={showTable}>{showTable ? "Hide full results table" : "View full results table"}</button></aside>
        </div>

        {detail && <article className="card profile-card"><div className="profile-header"><div><span className="eyebrow">Selected county</span><h3>{detail.county}, {detail.state_name}</h3><p>FIPS {detail.fips} · Population {detail.population?.toLocaleString() ?? "unavailable"}</p></div><div className="score-lockup"><span className="priority-pill review">{detail.priority}</span><strong>{detail.score.score}</strong><span>/ 100</span></div></div><div className="profile-grid"><div className="why-panel"><h4>Why this county surfaced</h4><ol>{reasonsFor(detail).map((reason, index) => <li key={reason}><span>{index + 1}</span><p>{reason}</p></li>)}</ol><div className="briefing-actions"><button className="button secondary" onClick={copyBriefing}>{copied ? "Briefing copied" : "Copy leadership briefing"}</button><a href="#scoring">Adjust assumptions</a></div></div><div className="signals-panel"><h4>Score components</h4>{[["Human signal weakness", detail.score.human_weakness],["Ecological evidence", detail.score.ecological],["Community barriers", detail.score.community]].map(([label, value]) => <div className="signal-row" key={label}><div className="signal-copy"><span>{label}</span><strong>{value}</strong></div><div className="signal-track"><span style={{width: `${value}%`}}/></div></div>)}</div><div className="ledger-panel"><h4>Evidence ledger</h4><dl><div><dt>Human record</dt><dd>{detail.human_status.replaceAll("_", " ")}</dd></div><div><dt>Ixodes status</dt><dd>{detail.tick_status}</dd></div><div><dt>B. burgdorferi</dt><dd>{detail.burgdorferi_status}</dd></div><div><dt>SVI percentile</dt><dd>{detail.svi_percentile == null ? "Unavailable" : `${Math.round(detail.svi_percentile * 100)}th`}</dd></div><div><dt>Uninsured</dt><dd>{detail.uninsured_percent == null ? "Unavailable" : `${detail.uninsured_percent}%`}</dd></div><div><dt>RUCC 2023</dt><dd>{detail.rucc_2023 ?? "Unavailable"}</dd></div></dl></div></div></article>}

        {showTable && <div className="card full-table"><h3>Complete filtered results</h3><div className="table-scroll"><table><caption>All counties matching the current filters, ranked by Surveillance Gap Score.</caption><thead><tr><th>Rank</th><th>County</th><th>FIPS</th><th>Score</th><th>Priority</th></tr></thead><tbody>{filtered.map((county, index) => <tr key={county.fips}><td>{index + 1}</td><td><button onClick={() => { setSelectedFips(county.fips); document.getElementById("atlas")?.scrollIntoView(); }}>{county.county}, {county.state}</button></td><td>{county.fips}</td><td>{county.score.score}</td><td>{county.priority}</td></tr>)}</tbody></table></div></div>}
        <p className="sr-status" aria-live="polite">{scoresQuery.isFetching ? "Updating county scores." : `${filtered.length} counties match the current filters.`}</p>
      </section>

      <section className="scoring-section section" id="scoring"><div className="section-heading light-heading"><div><span className="eyebrow light">Transparent assumptions</span><h2>Scoring lab</h2><p>Change the three exposed assumptions. The API recomputes every county using the governed methodology.</p></div></div><div className="scoring-grid"><article className="formula-card"><span className="formula-label">Default formula</span><div className="formula"><span>Human signal weakness</span><b>×</b><span>{settings.ecological_share}% ecological + {100 - settings.ecological_share}% community</span></div><p>Missing county-linked human records remain an explicit assumption and never become zero cases.</p></article><div className="controls-card"><label className="range-control"><div><span>Ecological share</span><strong>{settings.ecological_share}%</strong></div><input aria-label="Ecological share" type="range" min="40" max="85" step="5" value={settings.ecological_share} onChange={(event) => setSettings({...settings, ecological_share: Number(event.target.value)})}/><small>Balances ecological evidence against community barriers.</small></label><label className="range-control"><div><span>Low-incidence breakpoint</span><strong>{settings.low_incidence_breakpoint} / 100k</strong></div><input aria-label="Low-incidence breakpoint" type="range" min="5" max="25" value={settings.low_incidence_breakpoint} onChange={(event) => setSettings({...settings, low_incidence_breakpoint: Number(event.target.value)})}/><small>Published incidence at this value has no human-signal weakness.</small></label><label className="range-control"><div><span>No county-linked record value</span><strong>{settings.missing_human_weakness}</strong></div><input aria-label="No county-linked record value" type="range" min="40" max="90" step="5" value={settings.missing_human_weakness} onChange={(event) => setSettings({...settings, missing_human_weakness: Number(event.target.value)})}/><small>Represents uncertainty from missing publishable county records.</small></label></div></div></section>

      <section className="methods-section section" id="methods"><div className="section-heading"><div><span className="eyebrow">Data and interpretation</span><h2>Evidence with its limits attached</h2><p>Every displayed score retains its source vintage, geography, methodology version, and limitations.</p></div><span className="version-stamp">Generated {new Date(metadata.generated_at).toLocaleDateString()} · Loaded {new Date(metadata.loaded_at).toLocaleDateString()}</span></div><div className="source-grid">{metadata.sources.map((source, index) => <a className="source-card" key={source.key} href={source.url} target="_blank" rel="noreferrer"><span>0{index + 1}</span><h3>{source.label}</h3><strong>{source.vintage}</strong><p>{source.note}</p><small>Open source ↗</small></a>)}</div><div className="guardrail-grid"><article><span className="guardrail-icon">!</span><h3>Not diagnosis</h3><p>County patterns never determine an individual patient’s diagnosis or safety.</p></article><article><span className="guardrail-icon">↗</span><h3>Not exposure location</h3><p>Human surveillance is organized by residence, not confirmed exposure.</p></article><article><span className="guardrail-icon">∅</span><h3>Missing is not zero</h3><p>No record can reflect sampling, testing, reporting, suppression, or publication limits.</p></article><article><span className="guardrail-icon">≈</span><h3>Different vintages</h3><p>Inputs are public snapshots with different release dates, not real-time surveillance.</p></article></div><div className="mvp-boundary"><div><span className="eyebrow">MVP boundary</span><h3>Useful for prioritizing questions—not answering them alone.</h3></div><div className="boundary-columns"><div><strong>Included now</strong><ul><li>Human surveillance floor</li><li>Tick and pathogen status</li><li>SVI, uninsured percentile, and rurality</li></ul></div><div><strong>Deferred</strong><ul><li>Land cover and habitat suitability</li><li>State and local validation layers</li><li>Provider and laboratory capacity</li></ul></div></div></div><p className="limitations"><strong>Release limitation:</strong> {metadata.limitations}</p></section>
      <footer><div className="footer-brand"><span className="brand-mark">+</span><span>One Health Lyme Gap Atlas</span></div><p>Independent Caraway Labs prototype. Views do not represent an employer or public health laboratory.</p><a href="#atlas">Back to Atlas ↑</a></footer>
    </main>
  );
}

export default function Page() {
  return <Suspense fallback={<main className="load-state"><h1>Loading the Atlas</h1></main>}><AtlasPage/></Suspense>;
}
