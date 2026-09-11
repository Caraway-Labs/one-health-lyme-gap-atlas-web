import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { CountyScoreSummary } from "@/generated/models";
import {
  analyticsControlAttributes,
  type GeographySelectionSurface,
} from "@/lib/atlas-analytics";
import { plainPriority } from "@/lib/atlas-ui";

export function RankedCounties({
  counties,
  selectedFips,
  showTable,
  onSelect,
  onToggleTable,
}: {
  counties: CountyScoreSummary[];
  selectedFips: string;
  showTable: boolean;
  onSelect: (fips: string, surface: GeographySelectionSurface) => void;
  onToggleTable: () => void;
}) {
  return (
    <Card
      className="rank-card gap-0 py-0"
      aria-label="Counties to review"
      role="complementary"
    >
      <div className="card-title-row compact">
        <div>
          <span className="eyebrow">Suggested review order</span>
          <h3>Counties to review</h3>
        </div>
        <span className="result-count">{counties.length}</span>
      </div>
      <div
        className="rank-list"
        role="list"
        aria-label="Counties suggested for review"
      >
        {counties.slice(0, 40).map((county, index) => (
          <div role="listitem" key={county.fips}>
            <button
              {...analyticsControlAttributes("ranked_county_select")}
              type="button"
              className={`rank-row ${county.fips === selectedFips ? "active" : ""}`}
              onClick={() => onSelect(county.fips, "ranked_list")}
            >
              <span className="rank-number">{index + 1}</span>
              <span className="rank-name">
                <strong>
                  {county.county}, {county.state}
                </strong>
                <small>
                  FIPS {county.fips} · {plainPriority(county.priority)}
                </small>
              </span>
              <span className="rank-score" style={{ background: county.color }}>
                {county.score.score}
              </span>
            </button>
          </div>
        ))}
      </div>
      <p className="list-note">
        Showing the first 40 filtered counties. The accessible table and CSV
        include the complete result.
      </p>
      <Button
        {...analyticsControlAttributes("results_table_toggle")}
        aria-expanded={showTable}
        className="table-toggle"
        onClick={onToggleTable}
        variant="outline"
      >
        {showTable ? "Hide full county list" : "View full county list"}
      </Button>
    </Card>
  );
}
