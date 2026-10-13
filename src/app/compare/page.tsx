import type { Metadata } from "next";

import { ResetCompareExperience } from "@/features/ux-reset/compare/reset-compare-experience";
import { pageMetadataForResetRoute } from "@/features/ux-reset/paths";
import { RESET_COMPARE_PATH } from "@/features/ux-reset/routes";

export const metadata: Metadata = {
  ...pageMetadataForResetRoute("compare"),
  alternates: { canonical: RESET_COMPARE_PATH },
  robots: { follow: false, index: false },
};

export default function ComparePage() {
  return <ResetCompareExperience />;
}
