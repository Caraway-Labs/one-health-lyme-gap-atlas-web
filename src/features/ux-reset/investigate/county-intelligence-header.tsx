import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type CountyIntelligenceHeaderModel = {
  countyLabel: string | null;
  fips: string | null;
  releaseId: string | null;
  returnHref: string;
  scopeLabel: string;
  stateLabel: string | null;
};

/**
 * County identity and the return path for a single-county investigation.
 * The label is shown only after governed geography has been validated.
 */
export function CountyIntelligenceHeader({
  model,
}: {
  model: CountyIntelligenceHeaderModel;
}) {
  const title = model.countyLabel ?? model.fips ?? "Choose a county";
  return (
    <header
      className="ux-reset-investigate-header"
      data-county={model.fips ?? ""}
      data-release={model.releaseId ?? ""}
      data-scope={model.scopeLabel}
      data-testid="investigate-header"
    >
      <p className="eyebrow">Investigate</p>
      <h1>{title}</h1>
      <p className="type-body" data-testid="investigate-origin">
        {model.fips ? (
          <>
            FIPS {model.fips}
            {model.stateLabel ? ` · ${model.stateLabel}` : null}
            {". "}
          </>
        ) : null}
        Opened from <strong>{model.scopeLabel}</strong> review.
        {model.releaseId ? ` Release ${model.releaseId}.` : null}
      </p>
      <Link
        className={cn(buttonVariants(), "ux-reset-investigate-action")}
        data-county={model.fips ?? ""}
        data-testid="investigate-return"
        data-variant="primary"
        href={model.returnHref}
      >
        Return to Review
      </Link>
    </header>
  );
}
