import { describe, expect, it } from "vitest";

import { ASSISTANT_STARTER_PROMPTS } from "@/lib/assistant-starter-prompts";

const DISALLOWED_PHRASES = [
  "diagnose",
  "diagnosis",
  "treatment",
  "your patient",
  "atlas data",
  "atlas county",
  "atlas score",
  "county map",
  "county rank",
  "geographic explorer",
  "both sources",
] as const;

describe("assistant starter prompts", () => {
  it("defines a compact set of literature-only starters", () => {
    expect(ASSISTANT_STARTER_PROMPTS.length).toBeGreaterThanOrEqual(3);
    expect(ASSISTANT_STARTER_PROMPTS.length).toBeLessThanOrEqual(5);
    for (const prompt of ASSISTANT_STARTER_PROMPTS) {
      expect(prompt.label.length).toBeGreaterThan(0);
      expect(prompt.question.length).toBeLessThanOrEqual(200);
      const lower = prompt.question.toLowerCase();
      for (const phrase of DISALLOWED_PHRASES) {
        expect(lower).not.toContain(phrase);
      }
    }
  });
});
