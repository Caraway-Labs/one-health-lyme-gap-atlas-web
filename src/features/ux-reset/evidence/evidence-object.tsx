import { Info } from "lucide-react";

import { Card } from "@/components/ui/card";
import type { ContentSurface } from "@/lib/atlas-analytics";
import { cn } from "@/lib/utils";

import { EvidenceProvenanceChips } from "./evidence-provenance-chips";
import { EvidenceProvenanceInspect } from "./evidence-provenance-inspect";
import {
  EvidenceStateGlyph,
  evidenceStateClassName,
} from "./evidence-state-glyph";
import { EvidenceStateStrip } from "./evidence-state-strip";
import { evidenceAvailabilityValues, type EvidenceObjectModel } from "./types";
import {
  evidenceAvailabilityLabel,
  evidenceReasonLabel,
} from "./value-state-contract";

import "./evidence-contract.css";

type ClaimHeadingLevel = "h3" | "h4" | "h5";

type EvidenceObjectProps = {
  className?: string;
  claimHeadingLevel?: ClaimHeadingLevel;
  contentSurface?: ContentSurface;
  model: EvidenceObjectModel;
  /**
   * `standard` keeps the label/value strip used by Compare and Investigate.
   * `compact` is the Atlas Explorer card: state glyph and word, value, one
   * provenance chip row, and the single inspect action.
   */
  presentation?: "compact" | "standard";
  /** Short strip sentence. Defaults to the limitations disclosure. */
  showCaveat?: boolean;
  showGovernedLimitations?: boolean;
  showReason?: boolean;
};

function CompactEvidenceObject({
  className,
  claimHeadingLevel = "h3",
  contentSurface = "source_card",
  model,
  revealCaveat,
  showGovernedLimitations,
  showReason,
}: Omit<EvidenceObjectProps, "presentation" | "showCaveat"> & {
  revealCaveat: boolean;
  showGovernedLimitations: boolean;
  showReason: boolean;
}) {
  const ClaimHeading = claimHeadingLevel;
  const { availability, provenance, reasonCode } = model;
  const unavailable = availability === evidenceAvailabilityValues.unavailable;
  const stateWord = evidenceAvailabilityLabel(availability);
  // Unavailable is shown once, as the value. Other states name themselves in
  // the heading row so the word is never missing.
  const valueIsStateWord = model.displayValue === stateWord;
  return (
    <Card
      className={cn(
        "atlas-evidence-card gap-2 px-3 py-3",
        evidenceStateClassName(availability),
        className
      )}
      data-evidence-availability={availability}
      data-presentation="compact"
      data-testid="ux-reset-evidence-object"
    >
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
        <ClaimHeading className="m-0 font-sans text-sm font-semibold">
          {model.claimLabel}
        </ClaimHeading>
        {unavailable ? null : (
          <EvidenceStateGlyph availability={availability} />
        )}
      </div>
      <p
        className="m-0 font-sans text-xl leading-tight font-semibold tabular-nums"
        data-testid="evidence-display-value"
      >
        {unavailable ? (
          <EvidenceStateGlyph
            availability={availability}
            label={model.displayValue}
            size="lg"
          />
        ) : (
          model.displayValue
        )}
      </p>
      {unavailable && !valueIsStateWord ? (
        <span className="sr-only">{stateWord}</span>
      ) : null}
      {model.valueNote ? (
        <p className="text-muted-foreground m-0 text-xs">{model.valueNote}</p>
      ) : null}
      {showReason && reasonCode ? (
        <p className="text-muted-foreground m-0 text-xs">
          {evidenceReasonLabel(reasonCode)}
        </p>
      ) : null}
      <EvidenceProvenanceChips
        omitUnavailableFields={unavailable}
        provenance={provenance}
      />
      {revealCaveat && provenance.materialCaveat ? (
        <p
          className="text-muted-foreground m-0 flex items-start gap-1 text-xs"
          role="note"
        >
          <Info aria-hidden="true" className="mt-0.5 size-3 shrink-0" />
          <span>{provenance.materialCaveat}</span>
        </p>
      ) : null}
      {reasonCode ? (
        <EvidenceProvenanceInspect
          availability={availability}
          contentSurface={contentSurface}
          provenance={provenance}
          reasonCode={reasonCode}
          showLimitations={showGovernedLimitations}
        />
      ) : (
        <EvidenceProvenanceInspect
          contentSurface={contentSurface}
          provenance={provenance}
          showLimitations={showGovernedLimitations}
          stateLabel={stateWord}
        />
      )}
    </Card>
  );
}

/**
 * Shared evidence row for Reset Review, Explore, Investigate, and Compare.
 * Keeps availability, value, provenance cues, and inspect action consistent.
 */
export function EvidenceObject({
  className,
  claimHeadingLevel = "h3",
  contentSurface = "source_card",
  model,
  presentation = "standard",
  showCaveat,
  showGovernedLimitations = true,
  showReason = false,
}: EvidenceObjectProps) {
  const revealCaveat = showCaveat ?? showGovernedLimitations;
  if (presentation === "compact") {
    return (
      <CompactEvidenceObject
        claimHeadingLevel={claimHeadingLevel}
        className={className}
        contentSurface={contentSurface}
        model={model}
        revealCaveat={revealCaveat}
        showGovernedLimitations={showGovernedLimitations}
        showReason={showReason}
      />
    );
  }
  const ClaimHeading = claimHeadingLevel;
  return (
    <Card
      className={cn("ux-reset-evidence-object", className)}
      data-evidence-availability={model.availability}
      data-testid="ux-reset-evidence-object"
    >
      <div className="ux-reset-evidence-object-heading">
        <ClaimHeading className="type-card">{model.claimLabel}</ClaimHeading>
        <p
          className="ux-reset-evidence-value type-metric"
          data-testid="evidence-display-value"
        >
          {model.displayValue}
        </p>
        {model.valueNote ? (
          <p className="type-small">{model.valueNote}</p>
        ) : null}
      </div>
      <EvidenceStateStrip
        model={model}
        showCaveat={revealCaveat}
        showReason={showReason}
      />
      {model.reasonCode ? (
        <EvidenceProvenanceInspect
          availability={model.availability}
          contentSurface={contentSurface}
          provenance={model.provenance}
          reasonCode={model.reasonCode}
          showLimitations={showGovernedLimitations}
        />
      ) : (
        <EvidenceProvenanceInspect
          contentSurface={contentSurface}
          provenance={model.provenance}
          showLimitations={showGovernedLimitations}
          stateLabel={evidenceAvailabilityLabel(model.availability)}
        />
      )}
    </Card>
  );
}
