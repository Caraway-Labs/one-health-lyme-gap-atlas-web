import { Suspense } from "react";

import { GeographicExplorer } from "@/features/geographic-explorer/explorer";
import { pageMetadataForRoute } from "@/lib/navigation";

import "@/features/geographic-explorer/explorer.css";

export const metadata = {
  ...pageMetadataForRoute("/geographic_explorer"),
  alternates: { canonical: "/geographic_explorer" },
  robots: { follow: false, index: false },
};

export default function GeographicExplorerPage() {
  return (
    <Suspense
      fallback={
        <main className="experiment-load">
          <h1>Loading geographic explorer</h1>
        </main>
      }
    >
      <GeographicExplorer />
    </Suspense>
  );
}
