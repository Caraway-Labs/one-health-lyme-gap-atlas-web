import { Suspense } from "react";
import { ExperimentAtlas } from "@/components/experiment-atlas";
export default function VariantFivePage() { return <Suspense fallback={<main className="experiment-load"><h1>Loading experiment</h1></main>}><ExperimentAtlas variant="compare" /></Suspense>; }
