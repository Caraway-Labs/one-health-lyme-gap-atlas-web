"use client";

import { SURVEILLANCE_INTELLIGENCE_GUIDE } from "@/features/ux-reset/surveillance-intelligence/surveillance-intelligence-copy";

export function SurveillanceIntelligenceGuide() {
  return (
    <details className="mt-3" data-testid="surveillance-intelligence-guide">
      <summary className="type-small min-h-11 cursor-pointer">
        How to read these results
      </summary>
      <p className="type-small m-0">{SURVEILLANCE_INTELLIGENCE_GUIDE}</p>
    </details>
  );
}
