import type { Metadata } from "next";

import { pageMetadataForResetRoute } from "@/features/ux-reset/paths";
import { ResetReviewExperience } from "@/features/ux-reset/review/reset-review-experience";

export const metadata: Metadata = pageMetadataForResetRoute("explorer");

export default function ResetReviewPage() {
  return <ResetReviewExperience />;
}
