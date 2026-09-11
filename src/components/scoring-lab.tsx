import { AtlasSectionHeader } from "@/components/atlas-section-header";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  analyticsControlAttributes,
  type ScoreControlId,
} from "@/lib/atlas-analytics";
import type { ScoreSettings } from "@/lib/atlas-ui";

type ScoreChange = { controlId: ScoreControlId; value: number };

export function ScoringLab({
  settings,
  onChange,
}: {
  settings: ScoreSettings;
  onChange: (settings: ScoreSettings, change: ScoreChange) => void;
}) {
  return (
    <section className="scoring-section section" id="scoring">
      <AtlasSectionHeader
        className="section-heading light-heading"
        description="Adjust the assumptions below to see how they affect the county ranking. The calculation is transparent and uses no predictive model."
        eyebrow="Transparent assumptions"
        eyebrowClassName="light"
        title="How counties are prioritized"
      />
      <div className="scoring-grid">
        <Card className="formula-card gap-0 bg-[rgba(255,255,255,0.06)] py-0 text-inherit ring-0">
          <span className="formula-label">How the ranking works</span>
          <p>
            Counties move higher in the review order when published case data
            are low or unavailable and other information suggests that Lyme
            could be harder to detect or deserves local verification.
          </p>
          <div className="formula">
            <span>Low or missing case data</span>
            <b>×</b>
            <span>
              tick and pathogen evidence + possible diagnosis/reporting barriers
            </span>
          </div>
          <p>Missing county case data are not treated as zero cases.</p>
        </Card>
        <Card className="controls-card gap-0 bg-[rgba(255,255,255,0.06)] py-0 text-inherit ring-0">
          <ScoreControl
            label="Weight given to tick and pathogen evidence"
            value={`${settings.ecological_share}%`}
            min={40}
            max={85}
            step={5}
            current={settings.ecological_share}
            note="Balances tick and pathogen evidence with possible diagnosis and reporting barriers."
            controlId="score_ecological_share"
            onChange={(value, change) =>
              onChange({ ...settings, ecological_share: value }, change)
            }
          />
          <ScoreControl
            label="Published rate considered clearly above low incidence"
            value={`${settings.low_incidence_breakpoint} per 100,000`}
            min={5}
            max={25}
            current={settings.low_incidence_breakpoint}
            note="At this published rate, low case data do not increase the ranking."
            controlId="score_low_incidence_breakpoint"
            onChange={(value, change) =>
              onChange({ ...settings, low_incidence_breakpoint: value }, change)
            }
          />
          <ScoreControl
            label="How missing county case data affect the ranking"
            value={String(settings.missing_human_weakness)}
            min={40}
            max={90}
            step={5}
            current={settings.missing_human_weakness}
            note="Choose how strongly the ranking responds when no county-level count was published. Missing data are not treated as zero cases."
            controlId="score_missing_human_weakness"
            onChange={(value, change) =>
              onChange({ ...settings, missing_human_weakness: value }, change)
            }
          />
        </Card>
      </div>
    </section>
  );
}

function ScoreControl({
  label,
  value,
  min,
  max,
  step = 1,
  current,
  note,
  onChange,
  controlId,
}: {
  label: string;
  value: string;
  min: number;
  max: number;
  step?: number;
  current: number;
  note: string;
  onChange: (value: number, change: ScoreChange) => void;
  controlId: ScoreControlId;
}) {
  return (
    <label className="range-control">
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
      <Input
        {...analyticsControlAttributes(controlId)}
        aria-label={label}
        className="h-auto border-0 bg-transparent px-0 py-0"
        type="range"
        min={min}
        max={max}
        step={step}
        value={current}
        onChange={(event) => {
          const nextValue = Number(event.target.value);
          onChange(nextValue, { controlId, value: nextValue });
        }}
      />
      <small>{note}</small>
    </label>
  );
}
