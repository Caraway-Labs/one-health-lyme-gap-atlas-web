import { AtlasMap } from "@/components/atlas-map";
import { AtlasMapLegend } from "@/components/atlas-map-legend";
import { AtlasSectionHeader } from "@/components/atlas-section-header";
import { AtlasStatusMessage } from "@/components/atlas-status-message";
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
        <AtlasSectionHeader
          aside={
            <Badge className="map-scope h-auto" variant="secondary">
              {selectedDistrict === "ALL"
                ? mapState === "ALL"
                  ? "Select a county to highlight its state"
                  : `${mapState} highlighted`
                : `${selectedDistrict} highlighted`}
            </Badge>
          }
          className="card-title-row"
          eyebrow="County Review Priority"
          headingLevel="h3"
          title="Counties suggested for review"
        />
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
            <AtlasStatusMessage className="map-loading" tone="loading">
              Loading map…
            </AtlasStatusMessage>
          )}
        </div>
        <AtlasMapLegend
          caption={
            selectedDistrict === "ALL"
              ? mapState === "ALL"
                ? "Select a county to highlight its state."
                : `The selected county is in ${mapState}.`
              : "Outlined counties belong to the selected health district."
          }
        />
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
            <AtlasStatusMessage tone="empty">
              <p>Select a county to see its details.</p>
            </AtlasStatusMessage>
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
