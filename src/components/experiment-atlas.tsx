"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { countyV1CountiesFipsGet, geometryV1AtlasGeometryGet, metadataV1AtlasMetadataGet, scoresV1AtlasScoresGet } from "@/generated/atlas";
import type { AtlasMetadata, CountyDetail, CountyScoreSummary, ScoreCollection } from "@/generated/models";
import { AtlasFilters } from "@/components/atlas-filters";
import { AtlasMap } from "@/components/atlas-map";
import { ResultsTable } from "@/components/results-table";
import { EVIDENCE_VIEWS, type EvidenceView, type ScoreSettings, matchesEvidence, numericParam, reasonsFor } from "@/lib/atlas-ui";

export type ExperimentVariant = "decision" | "guided" | "workbench" | "explain" | "compare" | "wide-workbench";

type ExperimentProps = { variant: ExperimentVariant };

const copy = {
  decision: { eyebrow: "One Health Lyme Gap Atlas", title: "A clear starting point for county review", description: "See the selected county, the evidence behind it, and the guardrails before opening the full Atlas." },
  guided: { eyebrow: "One Health Lyme Gap Atlas", title: "Explore a county, one step at a time", description: "Choose a place, read the evidence, then decide what question to investigate next." },
  workbench: { eyebrow: "One Health Lyme Gap Atlas", title: "Explore county evidence in one place", description: "Keep the county list, map, and selected county together while you investigate." },
  explain: { eyebrow: "One Health Lyme Gap Atlas", title: "Understand what the score means", description: "Plain-language definitions, sources, and limitations sit beside the county result." },
  compare: { eyebrow: "One Health Lyme Gap Atlas", title: "Compare county evidence before deciding", description: "Compare the selected county with another county already in the same governed release." },
  "wide-workbench": { title: "Explore county evidence in one place", description: "Use the expanded workspace to keep county selection, the map, and evidence in view while you investigate." },
} as const;

function useDebounced<T>(value: T, delay = 180) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => { const timer = window.setTimeout(() => setDebounced(value), delay); return () => window.clearTimeout(timer); }, [value, delay]);
  return debounced;
}

export function ExperimentAtlas({ variant }: ExperimentProps) {
  const params = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const [stateFilter, setStateFilter] = useState(params.get("state") ?? "ALL");
  const [query, setQuery] = useState(params.get("q") ?? "");
  const [evidence, setEvidence] = useState<EvidenceView>(EVIDENCE_VIEWS.has(params.get("evidence") ?? "") ? params.get("evidence") as EvidenceView : "all");
  const [selectedFips, setSelectedFips] = useState(params.get("county")?.match(/^\d{5}$/)?.[0] ?? "06037");
  const [settings, setSettings] = useState<ScoreSettings>({ ecological_share: numericParam(params.get("eco"), 65, 40, 85, 5), low_incidence_breakpoint: numericParam(params.get("breakpoint"), 10, 5, 25), missing_human_weakness: numericParam(params.get("missing"), 75, 40, 90, 5) });
  const [showTable, setShowTable] = useState(false);
  const [step, setStep] = useState(0);
  const [comparisonFips, setComparisonFips] = useState("");
  const debouncedSettings = useDebounced(settings);

  const metadataQuery = useQuery({ queryKey: ["metadata"], queryFn: async () => (await metadataV1AtlasMetadataGet()).data as AtlasMetadata });
  const geometryQuery = useQuery({ queryKey: ["geometry", metadataQuery.data?.release_id], enabled: Boolean(metadataQuery.data), queryFn: async () => (await geometryV1AtlasGeometryGet({ dataset_version: metadataQuery.data!.release_id })).data as GeoJSON.FeatureCollection, staleTime: Infinity });
  const scoresQuery = useQuery({ queryKey: ["scores", metadataQuery.data?.release_id, debouncedSettings], enabled: Boolean(metadataQuery.data), placeholderData: (previous) => previous, queryFn: async () => (await scoresV1AtlasScoresGet({ dataset_version: metadataQuery.data!.release_id, ...debouncedSettings })).data as ScoreCollection });
  const detailQuery = useQuery({ queryKey: ["county", selectedFips, metadataQuery.data?.release_id, debouncedSettings], enabled: Boolean(metadataQuery.data && selectedFips), placeholderData: (previous) => previous, queryFn: async () => (await countyV1CountiesFipsGet(selectedFips, { dataset_version: metadataQuery.data!.release_id, ...debouncedSettings })).data as CountyDetail });

  const filtered = useMemo(() => (scoresQuery.data?.counties ?? []).filter((county) => {
    const needle = query.trim().toLowerCase();
    return county.in_contiguous_tick_scope && (stateFilter === "ALL" || county.state === stateFilter) && (!needle || `${county.county} ${county.state} ${county.fips}`.toLowerCase().includes(needle)) && matchesEvidence(county, evidence);
  }), [scoresQuery.data, stateFilter, query, evidence]);
  const comparison = useMemo(() => scoresQuery.data?.counties.find((county) => county.fips === comparisonFips) ?? filtered.find((county) => county.fips !== selectedFips) ?? null, [scoresQuery.data, comparisonFips, filtered, selectedFips]);

  useEffect(() => {
    const next = new URLSearchParams();
    if (metadataQuery.data?.release_id) next.set("dataset", metadataQuery.data.release_id);
    if (stateFilter !== "ALL") next.set("state", stateFilter);
    if (query) next.set("q", query);
    if (evidence !== "all") next.set("evidence", evidence);
    next.set("county", selectedFips); next.set("eco", String(settings.ecological_share)); next.set("breakpoint", String(settings.low_incidence_breakpoint)); next.set("missing", String(settings.missing_human_weakness));
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  }, [metadataQuery.data?.release_id, stateFilter, query, evidence, selectedFips, settings, router, pathname]);

  if (metadataQuery.isPending) return <main className="experiment-load"><h1>Loading the Atlas experiment</h1><p>Retrieving the current governed county release.</p></main>;
  if (metadataQuery.error || geometryQuery.error || scoresQuery.error || !metadataQuery.data) return <main className="experiment-load"><h1>This experiment is temporarily unavailable</h1><p>Unable to retrieve the current governed release.</p><button className="button primary" onClick={() => location.reload()}>Try again</button></main>;

  const detail = detailQuery.data;
  const title = copy[variant];
  const isWideWorkbench = variant === "wide-workbench";
  return <main className={`experiment experiment-${variant}`}>
    <header className="experiment-header">
      <div>{"eyebrow" in title && <span className="eyebrow">{title.eyebrow}</span>}<h1>{title.title}</h1><p>{title.description}</p></div>
    </header>
    <section id="atlas"><p className="experiment-boundary"><strong>For surveillance follow-up—not personal risk.</strong> This does not diagnose people, identify exposure locations, estimate true incidence, or show whether an individual is safe.</p>
    <ExperimentFilters metadata={metadataQuery.data} stateFilter={stateFilter} query={query} evidence={evidence} onStateChange={setStateFilter} onQueryChange={setQuery} onEvidenceChange={setEvidence} />
    {detail ? <>{isWideWorkbench && <ScoringAssumptions detail={detail} settings={settings} onChange={setSettings} collapsible />}<VariantBody variant={variant} detail={detail} counties={filtered} geometry={geometryQuery.data} selectedFips={selectedFips} comparison={comparison} step={step} showTable={showTable} onStep={setStep} onSelect={setSelectedFips} onComparison={setComparisonFips} onToggleTable={() => setShowTable((open) => !open)} />{!isWideWorkbench && <ScoringAssumptions detail={detail} settings={settings} onChange={setSettings} />}</> : <section className="experiment-card"><p>Loading the selected county…</p></section>}</section>
    <ReleaseStamp metadata={metadataQuery.data} />
  </main>;
}

function ExperimentFilters(props: Omit<Parameters<typeof AtlasFilters>[0], "onDownload">) {
  return <AtlasFilters {...props} onDownload={() => undefined} />;
}

function VariantBody({ variant, detail, counties, geometry, selectedFips, comparison, step, showTable, onStep, onSelect, onComparison, onToggleTable }: { variant: ExperimentVariant; detail: CountyDetail; counties: CountyScoreSummary[]; geometry?: GeoJSON.FeatureCollection; selectedFips: string; comparison: CountyScoreSummary | null; step: number; showTable: boolean; onStep: (step: number) => void; onSelect: (fips: string) => void; onComparison: (fips: string) => void; onToggleTable: () => void }) {
  if (variant === "guided") return <Guided detail={detail} counties={counties} geometry={geometry} selectedFips={selectedFips} step={step} onStep={onStep} onSelect={onSelect} />;
  if (variant === "workbench" || variant === "wide-workbench") return <Workbench detail={detail} counties={counties} geometry={geometry} selectedFips={selectedFips} onSelect={onSelect} />;
  if (variant === "explain") return <Explain detail={detail} counties={counties} geometry={geometry} selectedFips={selectedFips} onSelect={onSelect} />;
  if (variant === "compare") return <Compare detail={detail} counties={counties} comparison={comparison} onComparison={onComparison} />;
  return <Decision detail={detail} counties={counties} geometry={geometry} selectedFips={selectedFips} showTable={showTable} onSelect={onSelect} onToggleTable={onToggleTable} />;
}

function Decision({ detail, counties, geometry, selectedFips, showTable, onSelect, onToggleTable }: { detail: CountyDetail; counties: CountyScoreSummary[]; geometry?: GeoJSON.FeatureCollection; selectedFips: string; showTable: boolean; onSelect: (fips: string) => void; onToggleTable: () => void }) {
  return <><section className="decision-brief experiment-card"><DecisionSummary detail={detail} /><WhyPanel detail={detail} /><div className="next-action"><span className="eyebrow">Next useful question</span><p>Which local surveillance partner can help validate the pattern before resources are moved?</p></div></section><section className="experiment-data-grid"><MapPanel geometry={geometry} counties={counties} selectedFips={selectedFips} onSelect={onSelect} /><CountyList counties={counties} selectedFips={selectedFips} onSelect={onSelect} /></section><button className="table-toggle experiment-table-toggle" onClick={onToggleTable} aria-expanded={showTable}>{showTable ? "Hide accessible county table" : "View accessible county table"}</button>{showTable && <ResultsTable counties={counties} onSelect={onSelect} />}</>;
}

function Guided({ detail, counties, geometry, selectedFips, step, onStep, onSelect }: { detail: CountyDetail; counties: CountyScoreSummary[]; geometry?: GeoJSON.FeatureCollection; selectedFips: string; step: number; onStep: (step: number) => void; onSelect: (fips: string) => void }) {
  const steps = ["Choose a county", "Understand why", "Decide what to do next"];
  return <section className="guided-layout"><div className="guided-steps" role="tablist" aria-label="Explore this county in steps">{steps.map((label, index) => <button key={label} role="tab" aria-selected={step === index} onClick={() => onStep(index)}><span>{index + 1}</span>{label}</button>)}</div><div className="guided-stage experiment-card">{step === 0 && <><DecisionSummary detail={detail} /><h2>Choose a county to review</h2><p>Start with the ranked list or select a county on the map. The selected county stays in view as you learn more.</p><section className="guided-map"><MapPanel geometry={geometry} counties={counties} selectedFips={selectedFips} onSelect={onSelect} /></section></>}{step === 1 && <><h2>Why {detail.county} surfaced</h2><p>Read these as reasons to investigate, not conclusions about disease risk.</p><WhyPanel detail={detail} /><DefinitionCards /></>}{step === 2 && <><h2>Turn evidence into a follow-up question</h2><DecisionSummary detail={detail} /><div className="next-action"><strong>Suggested next step</strong><p>Ask whether local case reporting, tick sampling, testing access, or a data-publication limit could explain this pattern.</p></div></>}</div></section>;
}

function Workbench({ detail, counties, geometry, selectedFips, onSelect }: { detail: CountyDetail; counties: CountyScoreSummary[]; geometry?: GeoJSON.FeatureCollection; selectedFips: string; onSelect: (fips: string) => void }) {
  return <section className="workbench-layout" aria-label="County exploration workspace"><aside className="workbench-pane workbench-list"><span className="eyebrow">Counties</span><h2>Choose a county</h2><CountyList counties={counties} selectedFips={selectedFips} onSelect={onSelect} /></aside><section className="workbench-pane workbench-map"><span className="eyebrow">Pattern</span><h2>Where does it appear?</h2><MapPanel geometry={geometry} counties={counties} selectedFips={selectedFips} onSelect={onSelect} /></section><aside className="workbench-pane workbench-detail"><DecisionSummary detail={detail} /><WhyPanel detail={detail} /><details><summary>What these labels mean</summary><DefinitionCards /></details></aside></section>;
}

function Explain({ detail, counties, geometry, selectedFips, onSelect }: { detail: CountyDetail; counties: CountyScoreSummary[]; geometry?: GeoJSON.FeatureCollection; selectedFips: string; onSelect: (fips: string) => void }) {
  return <><section className="explain-hero experiment-card"><div><span className="eyebrow">Plain-language county readout</span><h2>{detail.county} needs a closer surveillance look.</h2><p>Its score is driven by a combination of lower published human surveillance signals, tick and pathogen evidence, and community context. That combination is a prompt to validate—not proof of disease burden.</p></div><DecisionSummary detail={detail} /></section><section className="explain-grid"><section className="experiment-card"><h2>What the score is built from</h2><DefinitionCards detail={detail} /></section><section className="experiment-card"><h2>Evidence for this county</h2><WhyPanel detail={detail} /><p className="definition-note">Missing published records are not zero cases. They can reflect sampling, testing, reporting, suppression, or publication limits.</p></section></section><section className="experiment-data-grid explain-map"><MapPanel geometry={geometry} counties={counties} selectedFips={selectedFips} onSelect={onSelect} /><CountyList counties={counties} selectedFips={selectedFips} onSelect={onSelect} /></section></>;
}

function Compare({ detail, counties, comparison, onComparison }: { detail: CountyDetail; counties: CountyScoreSummary[]; comparison: CountyScoreSummary | null; onComparison: (fips: string) => void }) {
  return <><section className="compare-grid"><section className="experiment-card"><span className="eyebrow">Selected county</span><DecisionSummary detail={detail} /></section><section className="experiment-card"><label className="comparison-select"><span>Compare with</span><select value={comparison?.fips ?? ""} onChange={(event) => onComparison(event.target.value)}>{counties.filter((county) => county.fips !== detail.fips).slice(0, 40).map((county) => <option key={county.fips} value={county.fips}>{county.county}, {county.state} · {county.score.score}</option>)}</select></label>{comparison ? <><h2>{comparison.county}, {comparison.state}</h2><p className="comparison-score">{comparison.score.score}<small>/ 100</small></p><p>{comparison.priority}</p></> : <p>Choose another county to compare.</p>}</section></section><section className="experiment-card comparison-takeaway"><h2>What is different?</h2>{comparison ? <ul><li><strong>Priority score:</strong> {scoreDifference(detail.score.score, comparison.score.score)}</li><li><strong>Published human surveillance signal:</strong> {scoreDifference(detail.score.human_weakness, comparison.score.human_weakness)}</li><li><strong>Tick and pathogen evidence:</strong> {scoreDifference(detail.score.ecological, comparison.score.ecological)}</li></ul> : null}<p>Use comparison to frame follow-up questions. It does not establish which county has more Lyme disease or where exposure occurred.</p></section><section className="experiment-card"><h2>Why the selected county surfaced</h2><WhyPanel detail={detail} /></section></>;
}

function DecisionSummary({ detail }: { detail: CountyDetail }) { return <div className="decision-summary"><div><span className="eyebrow">Selected county</span><h2>{detail.county}, {detail.state_name}</h2><p>FIPS {detail.fips} · Population {detail.population?.toLocaleString() ?? "unavailable"}</p></div><div className="experiment-score"><span>{detail.priority}</span><strong>{detail.score.score}</strong><small>follow-up priority score / 100</small></div></div>; }

function WhyPanel({ detail }: { detail: CountyDetail }) { return <div className="why-panel experiment-why"><h3>Why it surfaced</h3><ol>{reasonsFor(detail).map((reason, index) => <li key={reason}><span>{index + 1}</span><p>{reason}</p></li>)}</ol></div>; }

function DefinitionCards({ detail }: { detail?: CountyDetail }) { return <div className="definition-cards"><article><strong>Published human surveillance signal</strong><p>A lower or unavailable county-level published record can indicate a reason to look closer. It does not mean zero cases.</p>{detail && <small>Current component: {detail.score.human_weakness}</small>}</article><article><strong>Tick and pathogen evidence</strong><p>Published tick and pathogen records help identify places where surveillance evidence may not align.</p>{detail && <small>Current component: {detail.score.ecological}</small>}</article><article><strong>Community context</strong><p>Social vulnerability, insurance access, and rurality can affect how surveillance data is observed and used.</p>{detail && <small>Current component: {detail.score.community}</small>}</article></div>; }

function MapPanel({ geometry, counties, selectedFips, onSelect }: { geometry?: GeoJSON.FeatureCollection; counties: CountyScoreSummary[]; selectedFips: string; onSelect: (fips: string) => void }) { return <section className="experiment-map"><div className="map-wrap">{geometry ? <AtlasMap geometry={geometry as never} scores={counties} selectedFips={selectedFips} onSelect={onSelect} /> : <div className="map-loading">Loading map…</div>}</div><p>Map colors show a follow-up priority score, not individual risk. Gray counties are outside the scored comparison.</p></section>; }

function CountyList({ counties, selectedFips, onSelect }: { counties: CountyScoreSummary[]; selectedFips: string; onSelect: (fips: string) => void }) { return <div className="experiment-county-list" role="list" aria-label="Counties to review">{counties.slice(0, 20).map((county, index) => <div role="listitem" key={county.fips}><button className={county.fips === selectedFips ? "active" : ""} onClick={() => onSelect(county.fips)}><span>{index + 1}</span><strong>{county.county}, {county.state}</strong><em style={{ background: county.color }}>{county.score.score}</em></button></div>)}</div>; }

function ReleaseStamp({ metadata }: { metadata: AtlasMetadata }) { return <footer className="experiment-release" id="methods"><strong>Current governed snapshot</strong><span>{metadata.release_id} · {metadata.methodology_version} · Sources dated {metadata.sources.map((source) => source.vintage).join(", ")}</span><p>{metadata.limitations}</p></footer>; }
function scoreDifference(a: number, b: number) { const difference = Math.round((a - b) * 10) / 10; return difference === 0 ? "The same in this release." : `${Math.abs(difference)} points ${difference > 0 ? "higher" : "lower"} for the selected county.`; }

function ScoringAssumptions({ detail, settings, onChange, collapsible = false }: { detail: CountyDetail; settings: ScoreSettings; onChange: (settings: ScoreSettings) => void; collapsible?: boolean }) {
  const content = <><div><span className="eyebrow">Scoring assumptions</span><h2 id="score-assumptions-heading">How this follow-up priority score is calculated</h2><p>The score combines the published human surveillance signal with a blended context: <strong>{settings.ecological_share}% tick and pathogen evidence</strong> and <strong>{100 - settings.ecological_share}% community context</strong>. Missing county records are never treated as zero cases.</p></div><div className="score-assumption-grid"><ScoreAssumption label="Tick and pathogen share" value={`${settings.ecological_share}%`} min={40} max={85} step={5} note="Balances tick and pathogen evidence with community context." onChange={(value) => onChange({ ...settings, ecological_share: value })} /><ScoreAssumption label="Published-record threshold" value={`${settings.low_incidence_breakpoint} per 100,000`} min={5} max={25} note="At this published incidence value, the human-signal weakness is zero." onChange={(value) => onChange({ ...settings, low_incidence_breakpoint: value })} /><ScoreAssumption label="Missing county-record value" value={String(settings.missing_human_weakness)} min={40} max={90} step={5} note="Represents uncertainty where no county-level record is publishable." onChange={(value) => onChange({ ...settings, missing_human_weakness: value })} /></div><details className="score-components"><summary>See this county’s score components and source values</summary><dl><ScoreComponent label="Published human surveillance signal" component={detail.score.human_weakness} source={detail.human_status.replaceAll("_", " ")} /><ScoreComponent label="Tick evidence" component={detail.score.tick_signal} source={detail.tick_status} /><ScoreComponent label="Pathogen evidence" component={detail.score.pathogen_signal} source={detail.burgdorferi_status} /><ScoreComponent label="Social vulnerability" component={detail.score.svi_signal} source={detail.svi_percentile == null ? "Unavailable" : `${Math.round(detail.svi_percentile * 100)}th percentile`} /><ScoreComponent label="Insurance access" component={detail.score.access_signal} source={detail.uninsured_percent == null ? "Unavailable" : `${detail.uninsured_percent}% uninsured`} /><ScoreComponent label="Rurality (RUCC)" component={detail.score.rural_signal} source={detail.rucc_2023 == null ? "Unavailable" : `RUCC ${detail.rucc_2023}; 1 is most metropolitan and 9 most rural`} /></dl></details><Link className="adjust-link" href={`/?county=${detail.fips}&eco=${settings.ecological_share}&breakpoint=${settings.low_incidence_breakpoint}&missing=${settings.missing_human_weakness}#scoring`}>Open the full scoring lab</Link></>;
  if (collapsible) return <details className="score-explainer experiment-card score-accordion" id="scoring"><summary><span>Scoring calculation</span><small>Adjust assumptions and update the workspace</small></summary><div className="score-accordion-content">{content}</div></details>;
  return <section className="score-explainer experiment-card" id="scoring" aria-labelledby="score-assumptions-heading">{content}</section>;
}

function ScoreAssumption({ label, value, min, max, step = 1, note, onChange }: { label: string; value: string; min: number; max: number; step?: number; note: string; onChange: (value: number) => void }) { const current = Number.parseFloat(value); return <label className="experiment-range"><span>{label}</span><strong>{value}</strong><input aria-label={label} type="range" min={min} max={max} step={step} value={current} onChange={(event) => onChange(Number(event.target.value))} /><small>{note}</small></label>; }
function ScoreComponent({ label, component, source }: { label: string; component: number; source: string }) { return <div><dt>{label}</dt><dd><strong>{component}</strong><span>{source}</span></dd></div>; }
