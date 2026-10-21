import { Calendar, Database, History, ListFilter } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

import type { EvidenceProvenanceModel } from "./types";

const UNAVAILABLE = "Unavailable";

type Chip = {
  Icon: LucideIcon;
  key: string;
  label: string;
  value: string;
};

function isUnavailableValue(value: string): boolean {
  return value.trim().toLowerCase() === UNAVAILABLE.toLowerCase();
}

function provenanceChips(
  provenance: EvidenceProvenanceModel,
  omitUnavailableFields: boolean
): Chip[] {
  const chips: Chip[] = [
    {
      Icon: Database,
      key: "source",
      label: "Source family",
      value: provenance.sourceFamily,
    },
    {
      Icon: Calendar,
      key: "period",
      label: "Observation period",
      value: provenance.observationPeriod,
    },
  ];
  if (provenance.datasetVintage) {
    chips.push({
      Icon: History,
      key: "vintage",
      label: "Dataset vintage",
      value: provenance.datasetVintage,
    });
  }
  chips.push({
    Icon: ListFilter,
    key: "type",
    label: "Evidence type",
    value: provenance.evidenceType,
  });
  return omitUnavailableFields
    ? chips.filter((chip) => !isUnavailableValue(chip.value))
    : chips;
}

/**
 * Source, period, vintage, and evidence type as one compact chip row. The
 * visible label word stays in the accessible text. Inside an Unavailable
 * measure, fields whose value is Unavailable are not repeated.
 */
export function EvidenceProvenanceChips({
  className,
  omitUnavailableFields = false,
  provenance,
}: {
  className?: string;
  omitUnavailableFields?: boolean;
  provenance: EvidenceProvenanceModel;
}) {
  const chips = provenanceChips(provenance, omitUnavailableFields);
  if (chips.length === 0) {
    return null;
  }
  return (
    <ul
      className={cn(
        "m-0 flex list-none flex-wrap gap-1.5 p-0 text-xs",
        className
      )}
      data-testid="evidence-provenance-chips"
    >
      {chips.map(({ Icon, key, label, value }) => (
        <li
          className="border-border bg-background/70 text-muted-foreground inline-flex max-w-full items-start gap-1 rounded-md border px-2 py-0.5 leading-snug"
          data-chip={key}
          key={key}
        >
          <Icon aria-hidden="true" className="mt-0.5 size-3 shrink-0" />
          <span className="sr-only">{`${label}: `}</span>
          <span className="min-w-0 break-words">{value}</span>
        </li>
      ))}
    </ul>
  );
}
