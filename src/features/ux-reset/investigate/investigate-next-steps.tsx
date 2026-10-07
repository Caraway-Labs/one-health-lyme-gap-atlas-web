"use client";

import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import type { CountyEvidenceBundle } from "@/features/ux-reset/investigate/county-evidence";
import {
  investigateActionOffer,
  investigateCompareOffer,
  investigatePdfContext,
  type InvestigateCompareOfferKind,
} from "@/features/ux-reset/investigate/investigate-next-step";
import { InvestigatePdfExport } from "@/features/ux-reset/investigate/investigate-pdf-export";
import { cn } from "@/lib/utils";

function investigateCompareTestId(kind: InvestigateCompareOfferKind): string {
  switch (kind) {
    case "return": {
      return "investigate-continue";
    }
    case "start": {
      return "investigate-compare";
    }
    default: {
      const exhaustive: never = kind;
      return exhaustive;
    }
  }
}

export function InvestigateNextSteps({
  actionHref,
  bundle,
  compare,
  compareHref,
  countyFips,
  requestedPeriod,
  resolvedCounty,
}: {
  actionHref: string;
  bundle: CountyEvidenceBundle | null;
  compare: readonly string[];
  compareHref: string;
  countyFips: string;
  requestedPeriod: string | null;
  resolvedCounty: string | null;
}) {
  const offer = investigateCompareOffer({
    compare,
    resolvedCounty,
  });
  const actionOffer = investigateActionOffer({ bundle });
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
      {offer ? (
        <Link
          className={cn(buttonVariants(), "ux-reset-investigate-action")}
          data-destination="compare"
          data-offer={offer.kind}
          data-testid={investigateCompareTestId(offer.kind)}
          data-variant="primary"
          href={compareHref}
        >
          {offer.label}
        </Link>
      ) : null}
      {actionOffer ? (
        <Link
          className={cn(
            buttonVariants({ variant: "secondary" }),
            "ux-reset-investigate-action"
          )}
          data-destination="action"
          data-testid="investigate-action"
          data-variant="secondary"
          href={actionHref}
        >
          {actionOffer.label}
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
