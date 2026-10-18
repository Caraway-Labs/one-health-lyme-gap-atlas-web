import type { Metadata } from "next";

import { DataProvenanceExperience } from "@/features/ux-reset/data-provenance/data-provenance-page";
import { pageMetadataForResetRoute } from "@/features/ux-reset/paths";
import { RESET_DATA_PROVENANCE_PATH } from "@/features/ux-reset/routes";

export const metadata: Metadata = {
  ...pageMetadataForResetRoute("data-provenance"),
  alternates: { canonical: RESET_DATA_PROVENANCE_PATH },
  robots: { follow: false, index: false },
};

export default function DataProvenancePage() {
  return <DataProvenanceExperience />;
}
