import { ExplorerMapFollowUp } from "@/features/ux-reset/review/explorer-map-follow-up";
import type { GovernedReviewResultState } from "@/lib/follow-up-workflows";

/**
 * Suggested follow-up for the selected county. It renders nothing until a
 * county is chosen, and it lives in the rail beside the county summary. The
 * official resources moved to the context bar menu.
 */
export function ExplorerLowerWorkspace({
  fips,
  governedNextCheck = null,
  releaseId,
  reviewResultState = null,
  whatIfActive = false,
}: {
  fips: string | null;
  governedNextCheck?: string | null;
  releaseId: string | null;
  reviewResultState?: GovernedReviewResultState | null;
  whatIfActive?: boolean;
}) {
  return (
    <ExplorerMapFollowUp
      fips={fips}
      governedNextCheck={governedNextCheck}
      releaseId={releaseId}
      reviewResultState={reviewResultState}
      whatIfActive={whatIfActive}
    />
  );
}
