import { describe, expect, it } from "vitest";

import { aiEthicsContent } from "../src/lib/ai-ethics-content";
import { pageMetadataForRoute } from "../src/lib/navigation";

const RETIRED_COPY = [
  "planned",
  "pending",
  "in development",
  "experimental",
  "release pending",
] as const;

function publishedCopy() {
  return JSON.stringify(aiEthicsContent);
}

describe("AI Ethics content", () => {
  it("keeps a versioned public document and the approved meta description", () => {
    expect(aiEthicsContent.version).toBe("1.0.0");
    expect(aiEthicsContent.lastUpdated).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(pageMetadataForRoute("/ai-ethics")).toStrictEqual({
      description:
        "How One Health Atlas uses generative AI, machine learning, and AI interoperability to support public-health investigation, and the responsible-use commitments that guide them.",
      title: "AI Ethics | One Health Lyme Gap Atlas",
    });
  });

  it("names the three AI uses and keeps the Gap Score out of machine learning", () => {
    expect(aiEthicsContent.hero.title).toBe(
      "How Atlas uses AI and machine learning"
    );
    expect(aiEthicsContent.pillars.map((pillar) => pillar.title)).toStrictEqual(
      [
        "Understand the evidence",
        "Find patterns worth investigating",
        "Bring evidence into other workflows",
      ]
    );
    expect(
      aiEthicsContent.otherCapabilities.find((capability) =>
        capability.term.startsWith("Surveillance Gap Score")
      )?.description
    ).toContain("not a trained machine-learning model");
  });

  it("keeps the clinical and disease-risk limits and the public links", () => {
    const limits = aiEthicsContent.limitations.join(" ");
    expect(limits).toMatch(/not a clinical service/);
    expect(limits).toMatch(/do not predict disease risk/);
    expect(
      aiEthicsContent.feedback.links.map((link) => link.href)
    ).toStrictEqual([
      "/docs/releases-and-methodology",
      "/docs/api-mcp-and-access",
      "/privacy",
    ]);
  });

  it("does not publish maturity labels or internal tracking references", () => {
    const copy = publishedCopy();
    expect({
      issueReferences: copy.match(/#\d+/g),
      retiredPhrases: RETIRED_COPY.filter((phrase) =>
        copy.toLowerCase().includes(phrase)
      ),
    }).toStrictEqual({
      issueReferences: null,
      retiredPhrases: [],
    });
  });
});
