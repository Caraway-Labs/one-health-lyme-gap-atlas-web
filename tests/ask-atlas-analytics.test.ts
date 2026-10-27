import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  askOutcomeForFailure,
  askOutcomeForGovernedTurn,
  askOutcomeForLiteratureStatus,
  askSurfaceForLayout,
} from "../src/lib/ask-atlas-analytics";
import {
  analyticsEnumsAllowed,
  askOutcomes,
  createAtlasAnalytics,
  uiControlIds,
} from "../src/lib/atlas-analytics";

describe("Ask Atlas analytics mapping", () => {
  const amplitude = {
    init: vi.fn<
      (apiKey: string, options: Record<string, unknown>) => unknown
    >(),
    reset: vi.fn<() => unknown>(),
    setOptOut: vi.fn<(optOut: boolean) => unknown>(),
    track:
      vi.fn<
        (eventType: string, properties: Record<string, unknown>) => unknown
      >(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("maps layouts to the two assistant surfaces", () => {
    expect(askSurfaceForLayout("workspace")).toBe("ask_atlas");
    expect(askSurfaceForLayout("drawer")).toBe("evidence_chat");
  });

  it("maps literature statuses to closed outcomes", () => {
    expect(askOutcomeForLiteratureStatus("answered")).toBe("answered");
    expect(askOutcomeForLiteratureStatus("no_evidence")).toBe("no_evidence");
    expect(askOutcomeForLiteratureStatus("safety_refusal")).toBe("refused");
    expect(askOutcomeForLiteratureStatus("evidence_unavailable")).toBe(
      "unavailable"
    );
    expect(askOutcomeForLiteratureStatus("capacity_limited")).toBe(
      "unavailable"
    );
  });

  it("maps governed outcomes for structured and mixed turns", () => {
    const structured = (outcome: string) =>
      ({ kind: "structured", response: { answer: { outcome } } }) as never;
    const mixed = (outcome: string) =>
      ({ kind: "mixed", response: { outcome } }) as never;
    expect(askOutcomeForGovernedTurn(structured("ANSWERED"))).toBe("answered");
    expect(askOutcomeForGovernedTurn(mixed("SAFETY_REFUSAL"))).toBe("refused");
    expect(askOutcomeForGovernedTurn(mixed("SOURCE_UNAVAILABLE"))).toBe(
      "unavailable"
    );
    expect(askOutcomeForGovernedTurn(structured("QUERY_TOO_BROAD"))).toBe(
      "no_evidence"
    );
  });

  it("maps client failure states", () => {
    expect(askOutcomeForFailure("timeout")).toBe("timeout");
    expect(askOutcomeForFailure("rate_limited")).toBe("rate_limited");
    expect(askOutcomeForFailure("network_failure")).toBe("failed");
    expect(askOutcomeForFailure("response_unverified")).toBe("failed");
  });

  it("emits only closed Ask Atlas properties and drops unknown enums", async () => {
    const analytics = createAtlasAnalytics(async () => amplitude);
    await analytics.start("test-key");
    analytics.track({
      eventType: "atlas_ask_answered",
      properties: { ask_outcome: "answered", ask_surface: "ask_atlas" },
    });
    expect(amplitude.track).toHaveBeenCalledWith(
      "atlas_ask_answered",
      expect.objectContaining({
        ask_outcome: "answered",
        ask_surface: "ask_atlas",
      })
    );
    expect(
      analyticsEnumsAllowed({ ask_outcome: "free text", ask_surface: "x" })
    ).toBeFalsy();
    expect(askOutcomes).toContain("rate_limited");
  });

  it("no longer catalogues the never-attached footer controls", () => {
    expect(uiControlIds).not.toContain("footer_privacy");
    expect(uiControlIds).not.toContain("footer_back_to_atlas");
  });
});
