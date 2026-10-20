import type { Metadata } from "next";

import { IntelligenceFeedExperience } from "@/features/ux-reset/feed/intelligence-feed-page";
import { pageMetadataForResetRoute } from "@/features/ux-reset/paths";

export const metadata: Metadata = pageMetadataForResetRoute("feed");

export default function ResetFeedPage() {
  return <IntelligenceFeedExperience />;
}
