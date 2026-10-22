import type { Metadata } from "next";
import { Suspense } from "react";

import { IntelligenceFeedExperience } from "@/features/ux-reset/feed/intelligence-feed-page";
import { pageMetadataForResetRoute } from "@/features/ux-reset/paths";

export const metadata: Metadata = pageMetadataForResetRoute("feed");

export default function ResetFeedPage() {
  return (
    <Suspense
      fallback={
        <p className="type-body" role="status">
          Loading the intelligence feed
        </p>
      }
    >
      <IntelligenceFeedExperience />
    </Suspense>
  );
}
