"use client";

import { EvidenceProvenanceInspect } from "@/features/ux-reset/evidence/evidence-provenance-inspect";
import type { EvidenceObjectModel } from "@/features/ux-reset/evidence/types";
import { evidenceAvailabilityLabel } from "@/features/ux-reset/evidence/value-state-contract";

const UNKNOWN = "Unavailable";

function knownText(value: string | null | undefined): string | null {
  const text = value?.trim() ?? "";
  if (!text || text === UNKNOWN) {
    return null;
  }
  return text;
}

function consequentialNote(note: string | null | undefined): string | null {
  const text = note?.trim() ?? "";
  if (!text) {
    return null;
  }
  const genericOnly =
    /not a calculated difference|not a rank|observed or published/i.test(
      text
    ) &&
    !/floor|percentile|percent|zero|suppressed|unallocated|priority/i.test(
      text
    );
  return genericOnly ? null : text;
}

function visibleQualification(model: EvidenceObjectModel): string | null {
  if (model.reasonCode === "ZERO") {
    return "Published zero. This is not a missing value.";
  }
  const caveat = model.provenance.materialCaveat?.trim();
  if (caveat) {
    return caveat;
  }
  return consequentialNote(model.valueNote);
}

export function compareReaderState(reason: string, message: string): string {
  switch (reason) {
    case "missing": {
      return "No published county record. No record does not establish absence, and this absence is not zero.";
    }
    case "failed": {
      return "Couldn’t load this evidence.";
    }
    case "unsupported_period": {
      return "Not available for this period.";
    }
    case "release_mismatch": {
      return message;
    }
    default: {
      return message;
    }
  }
}

export function CompareCompactEvidence({
  model,
}: {
  model: EvidenceObjectModel;
}) {
  const source = knownText(model.provenance.sourceFamily);
  const period = knownText(model.provenance.observationPeriod);
  const vintage = knownText(model.provenance.datasetVintage);
  const qualification = visibleQualification(model);
  const coverageUnknown =
    model.reasonCode === "ENVIRONMENTAL_OUT_OF_SOURCE_COVERAGE" ||
    model.reasonCode === "ENVIRONMENTAL_SOURCE_MISSING";
  return (
    <div
      className="ux-reset-compare-value"
      data-evidence-availability={model.availability}
      data-testid="ux-reset-evidence-object"
    >
      <p
        className="ux-reset-evidence-value"
        data-testid="evidence-display-value"
      >
        {coverageUnknown && model.displayValue === UNKNOWN
          ? "Source coverage unknown."
          : model.displayValue}
      </p>
      <p className="ux-reset-compare-meta">
        <span>{source ? `Source ${source}` : "Source unknown"}</span>
        <span>
          {period
            ? `Observation period ${period}`
            : "Observation period unknown"}
        </span>
        <span>
          {vintage ? `Dataset vintage ${vintage}` : "Dataset vintage unknown"}
        </span>
      </p>
      {qualification ? (
        <p className="ux-reset-compare-qualification-line">{qualification}</p>
      ) : null}
      {knownText(model.provenance.evidenceType) ? (
        <span className="sr-only">
          Evidence type {model.provenance.evidenceType}
        </span>
      ) : null}
      {model.reasonCode ? (
        <EvidenceProvenanceInspect
          availability={model.availability}
          provenance={model.provenance}
          reasonCode={model.reasonCode}
          summaryLabel="Sources and limitations"
        />
      ) : (
        <EvidenceProvenanceInspect
          provenance={model.provenance}
          stateLabel={evidenceAvailabilityLabel(model.availability)}
          summaryLabel="Sources and limitations"
        />
      )}
    </div>
  );
}
