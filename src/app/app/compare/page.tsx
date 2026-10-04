import type { Metadata } from "next";

import { ResetCompareExperience } from "@/features/ux-reset/compare/reset-compare-experience";
import { pageMetadataForResetRoute } from "@/features/ux-reset/paths";

export const metadata: Metadata = pageMetadataForResetRoute("compare");

export default function ResetComparePage() {
  return <ResetCompareExperience />;
}
