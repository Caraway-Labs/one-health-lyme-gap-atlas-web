import { Input } from "@/components/ui/input";
import type { ScoreSettings } from "@/lib/atlas-ui";

export function ScoringLab({
  settings,
  onChange,
}: {
  settings: ScoreSettings;
  onChange: (settings: ScoreSettings) => void;
}) {
  return (
    <section className="scoring-section section" id="scoring">
      <div className="section-heading light-heading">
        <div>
          <span className="eyebrow light">Transparent assumptions</span>
          <h2>How counties are prioritized</h2>
          <p>
            Adjust the assumptions below to see how they affect the county
            ranking. The calculation is transparent and uses no predictive
            model.
          </p>
        </div>
      </div>
      <div className="scoring-grid">
        <article className="formula-card">
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
        </article>
        <div className="controls-card">
          <ScoreControl
            label="Weight given to tick and pathogen evidence"
            value={`${settings.ecological_share}%`}
            min={40}
            max={85}
            step={5}
            current={settings.ecological_share}
            note="Balances tick and pathogen evidence with possible diagnosis and reporting barriers."
            onChange={(value) =>
              onChange({ ...settings, ecological_share: value })
            }
          />
          <ScoreControl
            label="Published rate considered clearly above low incidence"
            value={`${settings.low_incidence_breakpoint} per 100,000`}
            min={5}
            max={25}
            current={settings.low_incidence_breakpoint}
            note="At this published rate, low case data do not increase the ranking."
            onChange={(value) =>
              onChange({ ...settings, low_incidence_breakpoint: value })
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
            onChange={(value) =>
              onChange({ ...settings, missing_human_weakness: value })
            }
          />
        </div>
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
}: {
  label: string;
  value: string;
  min: number;
  max: number;
  step?: number;
  current: number;
  note: string;
  onChange: (value: number) => void;
}) {
  return (
    <label className="range-control">
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
      <Input
        aria-label={label}
        className="h-auto border-0 bg-transparent px-0 py-0"
        type="range"
        min={min}
        max={max}
        step={step}
        value={current}
        onChange={(event) => onChange(Number(event.target.value))}
      />
      <small>{note}</small>
    </label>
  );
}
