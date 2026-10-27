// @vitest-environment node
import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { evidenceFlowAlt } from "@/features/docs/evidence-flow";
import { renderEvidenceFlowSvg } from "@/lib/render-evidence-flow-svg";

const LIGHT_FILE = "public/docs-assets/evidence-flow-light.svg";
const DARK_FILE = "public/docs-assets/evidence-flow-dark.svg";
const NODE_LABELS = ["Source", "Methodology", "Observation", "Citation"];

function diagramProblems(svg: string): string[] {
  const problems: string[] = [];
  const title = `<title id="atlas-evidence-flow-title">${evidenceFlowAlt}</title>`;
  if (!svg.includes(title)) {
    problems.push("missing title");
  }
  if (!svg.includes('role="img"')) {
    problems.push("missing role");
  }
  if (!svg.includes('aria-labelledby="atlas-evidence-flow-title"')) {
    problems.push("missing accessible name");
  }
  for (const label of NODE_LABELS) {
    if (!svg.includes(label)) {
      problems.push(`missing ${label}`);
    }
  }
  return problems;
}

describe("evidence flow SVG", () => {
  it("keeps the committed light and dark diagrams labeled", () => {
    expect(diagramProblems(readFileSync(LIGHT_FILE, "utf-8"))).toStrictEqual(
      []
    );
    expect(diagramProblems(readFileSync(DARK_FILE, "utf-8"))).toStrictEqual([]);
  });

  it("matches a fresh neutral Mermaid render", async () => {
    const rendered = await renderEvidenceFlowSvg("neutral");
    expect(rendered).toBe(readFileSync(LIGHT_FILE, "utf-8"));
  }, 30_000);

  it("matches a fresh dark Mermaid render", async () => {
    const rendered = await renderEvidenceFlowSvg("dark");
    expect(rendered).toBe(readFileSync(DARK_FILE, "utf-8"));
  }, 30_000);
});
