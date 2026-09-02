import { AtlasMap } from "@/components/atlas-map";
import { CountyProfile } from "@/components/county-profile";
import { RankedCounties } from "@/components/ranked-counties";
import type { CountyScoreSummary } from "@/generated/models";

export function AtlasDashboard({
  geometry,
  scores,
  counties,
  detail,
  copied,
  onCopy,
  selectedFips,
  selectedState,
  highlightState,
  selectedDistrict = "ALL",
  showTable,
  onSelect,
  onToggleTable,
}: {
  geometry?: GeoJSON.FeatureCollection;
  scores?: CountyScoreSummary[];
  counties?: CountyScoreSummary[];
  detail?: import("@/generated/models").CountyDetail;
  copied: boolean;
  onCopy: () => void;
  selectedFips: string;
  selectedState: string;
  highlightState?: string;
  selectedDistrict?: string;
  showTable: boolean;
  onSelect: (fips: string) => void;
  onToggleTable: () => void;
}) {
  const mapState = highlightState ?? selectedState;
  const results = counties ?? [];
  return (
    <div className="dashboard-grid">
      <article className="card map-card">
        <div className="card-title-row">
          <div>
            <span className="eyebrow">County Review Priority</span>
            <h3>Counties suggested for review</h3>
          </div>
          <span className="map-scope">
            {selectedDistrict === "ALL"
              ? mapState === "ALL"
                ? "Select a county to highlight its state"
                : `${mapState} highlighted`
              : `${selectedDistrict} highlighted`}
          </span>
        </div>
        <div className="map-wrap">
          {geometry && scores ? (
            <AtlasMap
              geometry={geometry as never}
              scores={scores}
              selectedFips={selectedFips}
              selectedState={mapState}
              selectedDistrict={selectedDistrict}
              onSelect={onSelect}
            />
          ) : (
            <div className="map-loading">Loading map…</div>
          )}
        </div>
        <div className="legend" aria-label="Map review priority legend">
          <span>Lower review priority</span>
          <span className="legend-ramp">
            <i />
            <i />
            <i />
            <i />
            <i />
            <i />
          </span>
          <span>Higher review priority</span>
          <small>
            {selectedDistrict === "ALL"
              ? mapState === "ALL"
                ? "Select a county to highlight its state."
                : `The selected county is in ${mapState}.`
              : "Outlined counties belong to the selected health district."}
          </small>
        </div>
      </article>
      <div className="dashboard-profile">
        {detail ? (
          <CountyProfile detail={detail} copied={copied} onCopy={onCopy} />
        ) : (
          <div className="card profile-card">
            <p>Select a county to see its details.</p>
          </div>
        )}
      </div>
      <RankedCounties
        counties={results}
        selectedFips={selectedFips}
        showTable={showTable}
        onSelect={onSelect}
        onToggleTable={onToggleTable}
      />
    </div>
  );
}
