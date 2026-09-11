export function AtlasMapLegend({
  caption,
  highLabel = "Higher review priority",
  lowLabel = "Lower review priority",
}: {
  caption: string;
  highLabel?: string;
  lowLabel?: string;
}) {
  return (
    <div
      className="legend"
      aria-label="Map review priority legend"
      role="group"
    >
      <span>{lowLabel}</span>
      <span className="legend-ramp">
        <i />
        <i />
        <i />
        <i />
        <i />
        <i />
      </span>
      <span>{highLabel}</span>
      <small>{caption}</small>
    </div>
  );
}
