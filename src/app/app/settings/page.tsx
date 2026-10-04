import type { Metadata } from "next";

import { pageMetadataForResetRoute } from "@/features/ux-reset/paths";
import { ResetSettingsExperience } from "@/features/ux-reset/settings/reset-settings-experience";

export const metadata: Metadata = pageMetadataForResetRoute("settings");

export default function ResetSettingsPage() {
  return <ResetSettingsExperience />;
}
