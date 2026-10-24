import type { Metadata } from "next";

import "maplibre-gl/dist/maplibre-gl.css";
import { ResetExploreExperience } from "@/features/ux-reset/explore/reset-explore-experience";
import { pageMetadataForResetRoute } from "@/features/ux-reset/paths";

export const metadata: Metadata = pageMetadataForResetRoute("explore");

export default function ResetExplorePage() {
  return <ResetExploreExperience />;
}
