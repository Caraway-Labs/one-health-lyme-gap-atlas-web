import { describe, expect, it } from "vitest";

import { aiEthicsContent } from "../src/lib/ai-ethics-content";

describe("AI Ethics content baseline", () => {
  it("keeps version and update metadata with the public content", () => {
    expect(aiEthicsContent.version).toMatch(/^\d+\.\d+\.\d+$/);
    expect(aiEthicsContent.lastUpdated).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(aiEthicsContent.maintenance.updateRule).toContain("version");
    expect(aiEthicsContent.maintenance.updateRule).toContain("last-updated");
  });

  it("keeps current behavior, approved architecture, and pending decisions distinct", () => {
    expect(new Set(aiEthicsContent.statements.map((statement) => statement.status))).toStrictEqual(
      new Set(["current", "approved-architecture", "pending-decision"]),
    );

    expect(aiEthicsContent.openCommitments).toHaveLength(6);
  });

  it("retains the public-health interpretation boundaries", () => {
    expect(aiEthicsContent.boundaries.join(" ")).toMatch(/not a clinical service/i);
    expect(aiEthicsContent.boundaries.join(" ")).toMatch(
      /not present its score as a disease-risk prediction/i,
    );
    expect(aiEthicsContent.statements[0].summary).toMatch(/non-predictive/i);
  });

  it("does not turn unresolved commitments into privacy promises", () => {
    const pendingStatement = aiEthicsContent.statements.find(
      (statement) => statement.status === "pending-decision",
    );

    expect(pendingStatement?.detail).toMatch(/not a policy, safeguard, or promise/i);
    expect(aiEthicsContent.relatedWork[0].detail).toMatch(/must not make new privacy promises/i);
  });
});
