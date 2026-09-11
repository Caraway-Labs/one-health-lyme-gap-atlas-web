import { AtlasMap } from "@/components/atlas-map";
import { CountyProfile } from "@/components/county-profile";
import { RankedCounties } from "@/components/ranked-counties";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import type { CountyScoreSummary } from "@/generated/models";
import type { GeographySelectionSurface } from "@/lib/atlas-analytics";

export function AtlasDashboard({
  geometry,
  scores,
  counties,
  detail,
  copied,
  onCopy,
  settings,
  datasetVersion,
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
  settings: import("@/lib/atlas-ui").ScoreSettings;
  datasetVersion: string;
  selectedFips: string;
  selectedState: string;
  highlightState?: string;
  selectedDistrict?: string;
  showTable: boolean;
  onSelect: (fips: string, surface: GeographySelectionSurface) => void;
  onToggleTable: () => void;
}) {
  const mapState = highlightState ?? selectedState;
  const results = counties ?? [];
  return (
    <div className="dashboard-grid">
      <Card className="map-card gap-0 py-0">
        <div className="card-title-row">
          <div>
            <span className="eyebrow">County Review Priority</span>
            <h3>Counties suggested for review</h3>
          </div>
          <Badge className="map-scope h-auto" variant="secondary">
            {selectedDistrict === "ALL"
              ? mapState === "ALL"
                ? "Select a county to highlight its state"
                : `${mapState} highlighted`
              : `${selectedDistrict} highlighted`}
          </Badge>
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
      </Card>
      <div className="dashboard-profile">
        {detail ? (
          <CountyProfile
            datasetVersion={datasetVersion}
            detail={detail}
            copied={copied}
            onCopy={onCopy}
            settings={settings}
          />
        ) : (
          <Card className="profile-card gap-0 py-0">
            <p>Select a county to see its details.</p>
          </Card>
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
