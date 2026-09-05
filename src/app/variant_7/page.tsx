import { Suspense } from "react";

import { GeographicExplorer } from "@/features/geographic-explorer/explorer";

import "@/features/geographic-explorer/explorer.css";

export const metadata = {
  title: "Geographic explorer | One Health Lyme Gap Atlas",
  alternates: { canonical: "/variant_7" },
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
