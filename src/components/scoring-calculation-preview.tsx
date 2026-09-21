import type { ScoreSettings } from "@/lib/atlas-ui";

/**
 * Read-only preview of the three active scoring assumptions, shown inside
 * the collapsed `variant_6` scoring accordion so users can see the current
 * values without expanding the full scoring controls.
 *
 * Values are derived directly from the `settings` prop (the same
 * URL-backed state used by the expanded sliders) and never own local state.
 */
export function ScoringCalculationPreview({
  settings,
}: {
  settings: ScoreSettings;
}) {
  return (
    <dl className="score-accordion-preview">
      <div className="score-accordion-preview-item">
        <dt>Tick/pathogen share</dt>
        <dd>{settings.ecological_share}%</dd>
      </div>
      <div className="score-accordion-preview-item">
        <dt>Published-record threshold</dt>
        <dd>{settings.low_incidence_breakpoint} per 100,000</dd>
      </div>
      <div className="score-accordion-preview-item">
        <dt>Missing county-record value</dt>
        <dd>{settings.missing_human_weakness}</dd>
      </div>
    </dl>
  );
}
