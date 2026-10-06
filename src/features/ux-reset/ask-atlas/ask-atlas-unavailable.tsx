export function AskAtlasUnavailableNotice({
  headingId,
}: {
  headingId: string;
}) {
  return (
    <div
      className="ux-reset-ask-atlas-disabled"
      data-assistant-state="backend_disabled"
      data-testid="ask-atlas-disabled"
      role="status"
    >
      <h2 id={headingId}>Ask Atlas</h2>
      <p>
        Ask Atlas is unavailable in this workspace. Review, Explore,
        Investigate, Compare, and Action stay usable without it.
      </p>
      <p>
        This is a service availability state, not a finding that evidence is
        absent.
      </p>
    </div>
  );
}
