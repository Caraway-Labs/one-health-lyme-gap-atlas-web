import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import "@testing-library/jest-dom/vitest";

import {
  evidenceFlowAlt,
  evidenceFlowSteps,
} from "@/features/docs/evidence-flow";
import { EvidenceFlowDiagram } from "@/features/docs/evidence-flow-diagram";

describe("evidence flow diagram", () => {
  afterEach(() => {
    cleanup();
  });

  it("names both theme images", () => {
    render(<EvidenceFlowDiagram />);
    const images = screen.getAllByRole("img", { name: evidenceFlowAlt });
    expect(images).toHaveLength(2);
    expect(images[0]).toHaveAttribute(
      "src",
      "/docs-assets/evidence-flow-light.svg"
    );
    expect(images[1]).toHaveAttribute(
      "src",
      "/docs-assets/evidence-flow-dark.svg"
    );
  });

  it("lists the same steps under the diagram", () => {
    render(<EvidenceFlowDiagram />);
    const caption = screen.getByRole("figure").querySelector("figcaption");
    expect(caption?.textContent).toContain("Null is not zero");
    expect(caption?.textContent).toContain("not a literature citation");
    expect(caption?.textContent).toContain(
      "does not show when the publisher last updated the data"
    );
    expect(
      evidenceFlowSteps.every((step) =>
        caption?.textContent?.includes(step.title)
      )
    ).toBeTruthy();
  });
});
