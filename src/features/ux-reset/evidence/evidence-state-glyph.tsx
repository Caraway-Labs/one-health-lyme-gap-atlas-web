import { CircleCheck, CircleDashed, CircleOff } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

import { evidenceAvailabilityValues, type EvidenceAvailability } from "./types";
import { evidenceAvailabilityLabel } from "./value-state-contract";

import "./evidence-state.css";

/** Treatment class for a container (card, row, chip) in each evidence state. */
export function evidenceStateClassName(
  availability: EvidenceAvailability
): string {
  switch (availability) {
    case evidenceAvailabilityValues.available: {
      return "atlas-state-available";
    }
    case evidenceAvailabilityValues.limited: {
      return "atlas-state-limited";
    }
    case evidenceAvailabilityValues.unavailable: {
      return "atlas-state-unavailable";
    }
    default: {
      const exhaustive: never = availability;
      return exhaustive;
    }
  }
}

function StateIcon({ availability }: { availability: EvidenceAvailability }) {
  switch (availability) {
    case evidenceAvailabilityValues.available: {
      return <CircleCheck aria-hidden="true" />;
    }
    case evidenceAvailabilityValues.limited: {
      return <CircleDashed aria-hidden="true" />;
    }
    case evidenceAvailabilityValues.unavailable: {
      return <CircleOff aria-hidden="true" />;
    }
    default: {
      const exhaustive: never = availability;
      return exhaustive;
    }
  }
}

type EvidenceStateGlyphProps = {
  availability: EvidenceAvailability;
  className?: string;
  /**
   * Visible text beside the icon. Defaults to the governed state word
   * (Available, Limited, or Unavailable). Pass the displayed value when that
   * value already is the state word, so the word is shown once. The icon is
   * decorative and never rendered without text.
   */
  label?: ReactNode;
  size?: "default" | "lg";
};

/**
 * Icon plus word for one evidence state (Available / Limited / Unavailable).
 * Shape and word carry the state, not color. Request loading and error states
 * are not evidence states and must not use this glyph.
 */
export function EvidenceStateGlyph({
  availability,
  className,
  label,
  size = "default",
}: EvidenceStateGlyphProps) {
  return (
    <span
      className={cn("atlas-state-glyph", className)}
      data-availability={availability}
      data-size={size}
      data-testid="evidence-state-glyph"
    >
      <StateIcon availability={availability} />
      <span>{label ?? evidenceAvailabilityLabel(availability)}</span>
    </span>
  );
}
