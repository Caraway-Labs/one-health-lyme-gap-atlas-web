import { describe, expect, it } from "vitest";

import { pageMetadataForRoute } from "../src/lib/navigation";
import { privacyContent } from "../src/lib/privacy-content";

const BANNED_PHRASES = [
  "data-use summary",
  "allowlisted",
  "analytical shell",
  "reviewed-literature chat is enabled",
  "this page does not state",
  "feature-gated",
] as const;

function publishedCopy() {
  return JSON.stringify(privacyContent);
}

function copyStrings(value: unknown): string[] {
  if (typeof value === "string") {
    return [value];
  }
  if (Array.isArray(value)) {
    return value.flatMap((item) => copyStrings(item));
  }
  if (value && typeof value === "object") {
    return Object.values(value).flatMap((item) => copyStrings(item));
  }
  return [];
}

describe("Privacy policy content", () => {
  it("keeps a versioned public document and the approved meta description", () => {
    expect(privacyContent.version).toBe("1.1.0");
    expect(privacyContent.lastUpdated).toBe("2026-10-25");
    expect(privacyContent.lastUpdated).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(pageMetadataForRoute("/privacy")).toStrictEqual({
      description:
        "How One Health Atlas collects, uses, and protects information, the service providers involved, how long data is kept, and the privacy choices available to every visitor.",
      title: "Privacy | One Health Lyme Gap Atlas",
    });
  });

  it("names the policy sections visitors need", () => {
    expect([
      privacyContent.hero.title,
      privacyContent.collection.title,
      privacyContent.questionsAsked.title,
      privacyContent.analytics.title,
      privacyContent.analytics.exclusionsTitle,
      privacyContent.providers.title,
      privacyContent.retention.title,
      privacyContent.rights.title,
      privacyContent.security.title,
      privacyContent.children.title,
      privacyContent.international.title,
      privacyContent.changes.title,
      privacyContent.questions.title,
    ]).toStrictEqual([
      "Privacy without the fine print.",
      "What we collect and why",
      "Questions you ask Atlas",
      "Your analytics choices",
      "What never goes into analytics",
      "Service providers we use",
      "How long we keep information",
      "Your rights and controls",
      "How we protect information",
      "Children",
      "Visitors outside the United States",
      "Changes to this policy",
      "Questions and requests",
    ]);
    expect(
      privacyContent.questions.links.map((link) => link.href)
    ).toStrictEqual(["/ai-ethics", "/about/caraway-labs"]);
    expect(privacyContent.commitments[0]).toStrictEqual({
      text: "You can read about Atlas, its data sources, its methods, and this policy without an account. Signing in is required for the Atlas workspace, where you explore the map and compare counties.",
      title: "Public information stays public",
    });
  });

  it("does not repeat a sentence or publish retired privacy wording", () => {
    const copy = publishedCopy();
    const sentences = copyStrings(privacyContent)
      .flatMap((value) => value.split(/(?<=\.)\s+/))
      .map((sentence) => sentence.trim())
      .filter((sentence) => sentence.length > 40);
    const repeated = sentences.filter(
      (sentence, index) => sentences.indexOf(sentence) !== index
    );
    expect({
      issueReferences: copy.match(/#\d+/g),
      processor: copy.match(/\bprocessor\b/i),
      repeated,
      retiredPhrases: BANNED_PHRASES.filter((phrase) =>
        copy.toLowerCase().includes(phrase)
      ),
      sdk: copy.match(/\bSDK\b/),
    }).toStrictEqual({
      issueReferences: null,
      processor: null,
      repeated: [],
      retiredPhrases: [],
      sdk: null,
    });
  });
});
