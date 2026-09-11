import type { Metadata } from "next";

import { DesignSystemGallery } from "@/components/design-system-gallery";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
  title: "Design system | One Health Lyme Gap Atlas",
  description:
    "Internal Lyme Atlas design-system gallery. Not linked from primary navigation.",
};

export default function DesignSystemPage() {
  return <DesignSystemGallery />;
}
