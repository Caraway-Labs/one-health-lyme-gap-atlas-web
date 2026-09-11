import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AtlasMapLegend } from "../src/components/atlas-map-legend";
import { AtlasPriorityBadge } from "../src/components/atlas-priority-badge";
import { AtlasSectionHeader } from "../src/components/atlas-section-header";
import { AtlasStatusMessage } from "../src/components/atlas-status-message";

describe("Atlas domain patterns", () => {
  it("renders a labeled section header and status tones", () => {
    render(
      <AtlasSectionHeader
        description="Filter counties before review."
        eyebrow="Interactive county atlas"
        title="Where should surveillance partners look next?"
        titleId="atlas-heading"
      />
    );
    expect(
      screen.getByRole("heading", {
        name: "Where should surveillance partners look next?",
      }).id
    ).toBe("atlas-heading");
    expect(screen.getByText("Interactive county atlas").textContent).toBe(
      "Interactive county atlas"
    );
  });

  it("exposes loading and error status roles", () => {
    const { rerender } = render(
      <AtlasStatusMessage title="Loading the Atlas" tone="loading">
        <p>Retrieving the governed county release.</p>
      </AtlasStatusMessage>
    );
    expect(screen.getByRole("status").dataset.atlasStatus).toBe("loading");

    rerender(
      <AtlasStatusMessage
        title="The Atlas is temporarily unavailable"
        tone="error"
      >
        <p>Unable to retrieve the current governed release.</p>
      </AtlasStatusMessage>
    );
    expect(screen.getByRole("alert").textContent).toContain(
      "The Atlas is temporarily unavailable"
    );
  });

  it("maps priority copy onto domain severity classes", () => {
    render(<AtlasPriorityBadge priority="Priority 1 — Immediate" />);
    expect(screen.getByText("Highest review priority").className).toContain(
      "priority-pill"
    );
    expect(screen.getByText("Highest review priority").className).toContain(
      "urgent"
    );
  });

  it("keeps a non-map legend caption for review-priority colors", () => {
    render(
      <AtlasMapLegend caption="Select a county to highlight its state." />
    );
    expect(
      screen.getByRole("group", { name: "Map review priority legend" })
        .textContent
    ).toContain("Lower review priority");
  });
});
