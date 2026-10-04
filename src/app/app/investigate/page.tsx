import type { Metadata } from "next";

import { pageMetadataForResetRoute } from "@/features/ux-reset/paths";
import { ResetPlaceholderPage } from "@/features/ux-reset/placeholder-page";

export const metadata: Metadata = pageMetadataForResetRoute("investigate");

export default function ResetInvestigatePage() {
  return <ResetPlaceholderPage routeId="investigate" />;
}
