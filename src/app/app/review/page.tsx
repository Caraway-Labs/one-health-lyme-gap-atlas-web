import type { Metadata } from "next";

import { pageMetadataForResetRoute } from "@/features/ux-reset/paths";
import { ResetPlaceholderPage } from "@/features/ux-reset/placeholder-page";

export const metadata: Metadata = pageMetadataForResetRoute("review");

export default function ResetReviewPage() {
  return <ResetPlaceholderPage routeId="review" />;
}
