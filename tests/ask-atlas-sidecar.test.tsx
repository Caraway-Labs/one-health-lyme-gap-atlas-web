import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import {
  AskAtlasInheritedContextProvider,
  useAskAtlasInheritedContext,
  usePublishAskAtlasInheritedContext,
} from "@/features/ux-reset/ask-atlas/ask-atlas-context";
import {
  inheritedContextFromReview,
  type AskAtlasInheritedContext,
} from "@/features/ux-reset/ask-atlas/inherited-context";

function ContextProbe() {
  const context = useAskAtlasInheritedContext();
  return (
    <p data-testid="published-release">
      {context?.fields.release.state === "validated"
        ? context.fields.release.id
        : "none"}
    </p>
  );
}

function Publisher({ value }: { value: AskAtlasInheritedContext | null }) {
  usePublishAskAtlasInheritedContext(value);
  return null;
}

describe("Ask Atlas inherited context", () => {
  afterEach(() => {
    cleanup();
  });

  it("clears inherited context when the publishing page unmounts", () => {
    const review = inheritedContextFromReview({
      rankedCounties: [
        { county: "Adams", fips: "08001", state_name: "Colorado" },
      ],
      releaseId: "alpha-2026",
      releaseReady: true,
      requestedCounty: "08001",
    });
    const { rerender } = render(
      <AskAtlasInheritedContextProvider>
        <Publisher value={review} />
        <ContextProbe />
      </AskAtlasInheritedContextProvider>
    );
    expect(screen.getByTestId("published-release").textContent).toBe(
      "alpha-2026"
    );
    rerender(
      <AskAtlasInheritedContextProvider>
        <ContextProbe />
      </AskAtlasInheritedContextProvider>
    );
    expect(screen.getByTestId("published-release").textContent).toBe("none");
  });
});
