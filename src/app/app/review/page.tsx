import type { Metadata } from "next";

import { ResetReviewExperience } from "@/features/ux-reset/review/reset-review-experience";
import { pageMetadataForResetRoute } from "@/features/ux-reset/paths";

export const metadata: Metadata = pageMetadataForResetRoute("review");

export default function ResetReviewPage() {
  return <ResetReviewExperience />;
}
