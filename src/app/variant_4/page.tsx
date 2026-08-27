import { Suspense } from "react";
import { ExperimentAtlas } from "@/components/experiment-atlas";
export default function VariantFourPage() { return <Suspense fallback={<main className="experiment-load"><h1>Loading experiment</h1></main>}><ExperimentAtlas variant="explain" /></Suspense>; }
