import type { Metadata } from "next";
import { Suspense } from "react";

import { ResourcesPage } from "@/features/resources/resources-page";
import { pageMetadataForRoute } from "@/lib/navigation";

export const metadata: Metadata = pageMetadataForRoute("/resources");

export default function ResourcesRoute() {
  return (
    <Suspense
      fallback={
        <p className="type-body" role="status">
          Loading resources
        </p>
      }
    >
      <ResourcesPage />
    </Suspense>
  );
}
