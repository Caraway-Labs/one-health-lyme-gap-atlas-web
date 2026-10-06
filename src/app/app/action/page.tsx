import type { Metadata } from "next";

import { ResetActionExperience } from "@/features/ux-reset/action/reset-action-experience";
import { pageMetadataForResetRoute } from "@/features/ux-reset/paths";

export const metadata: Metadata = pageMetadataForResetRoute("action");

export default function ResetActionPage() {
  return <ResetActionExperience />;
}
