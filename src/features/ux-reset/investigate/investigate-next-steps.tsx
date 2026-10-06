"use client";

import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import type { CountyEvidenceBundle } from "@/features/ux-reset/investigate/county-evidence";
import {
  investigateContinueDestination,
  investigatePdfContext,
} from "@/features/ux-reset/investigate/investigate-next-step";
import { InvestigatePdfExport } from "@/features/ux-reset/investigate/investigate-pdf-export";
import { cn } from "@/lib/utils";

export function InvestigateNextSteps({
  bundle,
  compare,
  compareHref,
  countyFips,
  requestedPeriod,
}: {
  bundle: CountyEvidenceBundle | null;
  compare: readonly string[];
  compareHref: string;
  countyFips: string;
  requestedPeriod: string | null;
}) {
  const destination = investigateContinueDestination({ compare });
  const pdfContext = bundle
    ? investigatePdfContext(bundle, requestedPeriod)
    : null;

  return (
    <section
      aria-label="What to inspect or do next"
      className="ux-reset-investigate-next"
      data-county={countyFips}
      data-testid="investigate-next-steps"
    >
      <h2>What to inspect or do next</h2>
      <p className="type-body">
        Ask Atlas is optional. This county can be read without it.
      </p>
      {destination === "compare" ? (
        <Link
          className={cn(buttonVariants(), "ux-reset-investigate-action")}
          data-destination="compare"
          data-testid="investigate-continue"
          data-variant="primary"
          href={compareHref}
        >
          Return to Compare
        </Link>
      ) : null}
      {bundle?.leadFinding ? (
        <a
          data-county={bundle.county.fips}
          data-testid="investigate-next-finding"
          href={`#investigate-observation-${bundle.leadFinding.observation.observation_id}`}
        >
          Inspect the finding for {bundle.county.label}
        </a>
      ) : null}
      {bundle?.leadLimitation ? (
        <a
          data-county={bundle.county.fips}
          data-testid="investigate-next-limitation"
          href={`#investigate-observation-${bundle.leadLimitation.observation.observation.observation_id}`}
        >
          Inspect the limitation for {bundle.county.label}
        </a>
      ) : null}
      {pdfContext ? <InvestigatePdfExport context={pdfContext} /> : null}
    </section>
  );
}
