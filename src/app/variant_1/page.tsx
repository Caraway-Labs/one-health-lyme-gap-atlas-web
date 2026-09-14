import { Suspense } from "react";

import { ExperimentAtlas } from "@/components/experiment-atlas";
import { pageMetadataForRoute } from "@/lib/navigation";

export const metadata = pageMetadataForRoute("/variant_1");

export default function VariantOnePage() {
  return (
    <Suspense
      fallback={
        <main className="experiment-load">
          <h1>Loading experiment</h1>
        </main>
      }
    >
      <ExperimentAtlas variant="decision" />
    </Suspense>
  );
}
