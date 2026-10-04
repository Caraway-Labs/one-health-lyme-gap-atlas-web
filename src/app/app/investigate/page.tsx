import type { Metadata } from "next";

import { ResetInvestigateExperience } from "@/features/ux-reset/investigate/reset-investigate-experience";
import { pageMetadataForResetRoute } from "@/features/ux-reset/paths";

export const metadata: Metadata = pageMetadataForResetRoute("investigate");

export default function ResetInvestigatePage() {
  return <ResetInvestigateExperience />;
}
