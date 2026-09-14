import { Suspense } from "react";

import { GeographicExplorer } from "@/features/geographic-explorer/explorer";
import { pageMetadataForRoute } from "@/lib/navigation";

import "@/features/geographic-explorer/explorer.css";

export const metadata = pageMetadataForRoute("/variant_7");

export default function VariantSevenPage() {
  return (
    <Suspense
      fallback={
        <main className="experiment-load">
          <h1>Loading experimental geographic explorer</h1>
        </main>
      }
    >
      <GeographicExplorer />
    </Suspense>
  );
}
