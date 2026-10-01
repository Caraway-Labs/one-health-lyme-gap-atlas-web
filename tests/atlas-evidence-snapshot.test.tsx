import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AtlasEvidenceSnapshot } from "@/components/atlas-evidence-snapshot";
import type { AtlasMetadata } from "@/generated/models";

const metadata: AtlasMetadata = {
  bundle_sha256: "a".repeat(64),
  generated_at: "2026-08-06T05:37:16Z",
  limitations: "Not individual risk.",
  loaded_at: "2026-08-15T00:00:00Z",
  methodology_version: "alpha-0.2.0",
  release_id: "alpha-2026-08-06",
  schema_version: "0.2.0",
  scope: "United States counties",
  score_defaults: {},
  sources: [
    {
      key: "human",
      label: "CDC Lyme surveillance",
      note: "Published floor.",
      url: "https://cdc.gov",
      vintage: "2023",
    },
  ],
  states: [],
};

describe(AtlasEvidenceSnapshot, () => {
  it("keeps technical identifiers in progressive disclosure", () => {
    render(<AtlasEvidenceSnapshot metadata={metadata} />);
    const disclosure = screen
      .getByText("Technical release and methodology identifiers")
      .closest("details");
    expect(disclosure?.hasAttribute("open")).toBeFalsy();
    fireEvent.click(
      screen.getByText("Technical release and methodology identifiers")
    );
    expect(screen.getByText("alpha-2026-08-06")).toBeTruthy();
    expect(screen.getByText("alpha-0.2.0")).toBeTruthy();
    expect(screen.getByText("CDC Lyme surveillance: 2023")).toBeTruthy();
  });
});
