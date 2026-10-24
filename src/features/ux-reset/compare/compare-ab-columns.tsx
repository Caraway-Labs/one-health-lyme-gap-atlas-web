/**
 * Shared Measure / County A / County B tracks.
 * Widths live in compare-aligned.css as --compare-col-label and
 * --compare-col-county. Every comparison table uses this colgroup.
 */
export function CompareAbColGroup() {
  return (
    <colgroup>
      <col className="compare-ab-col-label" />
      <col className="compare-ab-col-county" />
      <col className="compare-ab-col-county" />
    </colgroup>
  );
}
