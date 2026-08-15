import type { CountyScoreSummary } from "@/generated/models";
import { AtlasMap } from "@/components/atlas-map";
import { RankedCounties } from "@/components/ranked-counties";

export function AtlasDashboard({ geometry, scores, counties, selectedFips, showTable, onSelect, onToggleTable }: { geometry?: GeoJSON.FeatureCollection; scores?: CountyScoreSummary[]; counties?: CountyScoreSummary[]; selectedFips: string; showTable: boolean; onSelect: (fips: string) => void; onToggleTable: () => void }) {
  const results = counties ?? [];
  return <div className="dashboard-grid"><article className="card map-card"><div className="card-title-row"><div><span className="eyebrow">Surveillance Gap Score</span><h3>County pattern</h3></div><span className="map-scope">Contiguous U.S. scored scope</span></div><div className="map-wrap">{geometry && scores ? <AtlasMap geometry={geometry as never} scores={scores} selectedFips={selectedFips} onSelect={onSelect} /> : <div className="map-loading">Loading map…</div>}</div><div className="legend" aria-label="Map score legend"><span>Lower</span><span className="legend-ramp"><i /><i /><i /><i /><i /><i /></span><span>Higher</span><small>Gray counties are outside the scored comparison.</small></div></article><RankedCounties counties={results} selectedFips={selectedFips} showTable={showTable} onSelect={onSelect} onToggleTable={onToggleTable} /></div>;
}
