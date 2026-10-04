import type { Metadata } from "next";

import { pageMetadataForResetRoute } from "@/features/ux-reset/paths";
import { ResetPlaceholderPage } from "@/features/ux-reset/placeholder-page";

export const metadata: Metadata = pageMetadataForResetRoute("explore");

export default function ResetExplorePage() {
  return <ResetPlaceholderPage routeId="explore" />;
}
