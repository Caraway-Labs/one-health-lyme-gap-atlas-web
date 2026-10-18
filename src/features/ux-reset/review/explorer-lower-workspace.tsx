import { ExplorerMapFollowUp } from "@/features/ux-reset/review/explorer-map-follow-up";
import { ExplorerOfficialResources } from "@/features/ux-reset/review/explorer-official-resources";
import type { GovernedReviewResultState } from "@/lib/follow-up-workflows";

export function ExplorerLowerWorkspace({
  fips,
  governedNextCheck = null,
  releaseId,
  reviewResultState = null,
}: {
  fips: string | null;
  governedNextCheck?: string | null;
  releaseId: string | null;
  reviewResultState?: GovernedReviewResultState | null;
}) {
  return (
    <section
      aria-label="Follow-up and official resources"
      className="ux-reset-explorer-lower"
      data-testid="explorer-lower-workspace"
    >
      <ExplorerMapFollowUp
        fips={fips}
        governedNextCheck={governedNextCheck}
        releaseId={releaseId}
        reviewResultState={reviewResultState}
      />
      <ExplorerOfficialResources />
    </section>
  );
}
