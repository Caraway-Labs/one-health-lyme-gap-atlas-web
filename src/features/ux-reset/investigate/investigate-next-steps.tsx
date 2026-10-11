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
import type { ResolvedInvestigateFinding } from "@/features/ux-reset/investigate/investigate-visible-summary";
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
  actionBundle = null,
  actionHref,
  bundle,
  compare,
  compareHref,
  countyFips,
  finding,
  findingCountyLabel,
  requestedPeriod,
  resolvedCounty,
}: {
  actionBundle?: CountyEvidenceBundle | null;
  actionHref: string;
  /** Observation bundle. The PDF export reads this and does not repeat the finding sentence. */
  bundle: CountyEvidenceBundle | null;
  compare: readonly string[];
  compareHref: string;
  countyFips: string;
  finding: ResolvedInvestigateFinding | null;
  findingCountyLabel: string;
  requestedPeriod: string | null;
  resolvedCounty: string | null;
}) {
  const offer = investigateCompareOffer({
    compare,
    resolvedCounty,
  });
  const actionOffer = investigateActionOffer({
    bundle: actionBundle ?? bundle,
  });
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
      {finding?.inspectHref ? (
        <a
          data-county={countyFips}
          data-testid="investigate-next-finding"
          href={finding.inspectHref}
        >
          Inspect the finding for {findingCountyLabel}
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
