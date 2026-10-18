import type { Metadata } from "next";

import { pageMetadataForResetRoute } from "@/features/ux-reset/paths";
import { ResetReviewExperience } from "@/features/ux-reset/review/reset-review-experience";
import { ATLAS_EXPLORER_PATH } from "@/features/ux-reset/routes";

export const metadata: Metadata = {
  ...pageMetadataForResetRoute("explorer"),
  alternates: { canonical: ATLAS_EXPLORER_PATH },
  robots: { follow: false, index: false },
};

export default function AtlasExplorerPage() {
  return <ResetReviewExperience />;
}
