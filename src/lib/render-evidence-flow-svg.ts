import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

import { chromium, type Page } from "@playwright/test";

import {
  evidenceFlowAlt,
  evidenceFlowChart,
} from "../features/docs/evidence-flow";

const DIAGRAM_ID = "atlas-evidence-flow";
const LIGHT_SVG = "public/docs-assets/evidence-flow-light.svg";
const DARK_SVG = "public/docs-assets/evidence-flow-dark.svg";

export type EvidenceFlowTheme = "dark" | "neutral";

/**
 * Build-time Mermaid render. The docs page uses the saved SVG files, so the
 * browser does not load the Mermaid library.
 */
export async function renderEvidenceFlowSvg(
  theme: EvidenceFlowTheme
): Promise<string> {
  const require = createRequire(import.meta.url);
  const mermaidPath = require.resolve("mermaid/dist/mermaid.min.js");
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.goto("about:blank");
    await page.addScriptTag({ path: mermaidPath });
    const svg = await renderInPage(page, theme);
    return themeReadySvg(svg);
  } finally {
    await browser.close();
  }
}

async function renderInPage(
  page: Page,
  theme: EvidenceFlowTheme
): Promise<string> {
  return page.evaluate(
    async ({ chart, diagramId, mermaidTheme }) => {
      const api = (
        globalThis as unknown as {
          mermaid: {
            initialize: (options: unknown) => void;
            render: (id: string, source: string) => Promise<{ svg: string }>;
          };
        }
      ).mermaid;
      api.initialize({
        flowchart: {
          padding: 12,
          useMaxWidth: true,
        },
        htmlLabels: false,
        look: "classic",
        securityLevel: "strict",
        startOnLoad: false,
        theme: mermaidTheme,
      });
      const rendered = await api.render(diagramId, chart);
      return rendered.svg;
    },
    { chart: evidenceFlowChart, diagramId: DIAGRAM_ID, mermaidTheme: theme }
  );
}

export function themeReadySvg(svg: string): string {
  const titled = svg.replace(
    /<svg\b(?<attributes>[^>]*)>/,
    `<svg$<attributes>><title id="${DIAGRAM_ID}-title">${escapeXml(evidenceFlowAlt)}</title>`
  );
  return titled
    .replaceAll('role="graphics-document document"', 'role="img"')
    .replaceAll(' aria-roledescription="flowchart-v2"', "")
    .replace("<svg ", `<svg aria-labelledby="${DIAGRAM_ID}-title" `)
    .replace(/\sstyle="max-width:[^"]*"/, "");
}

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

const invokedDirectly = process.argv[1]?.endsWith(
  "render-evidence-flow-svg.ts"
);

if (invokedDirectly && process.argv.includes("--write")) {
  const [light, dark] = await Promise.all([
    renderEvidenceFlowSvg("neutral"),
    renderEvidenceFlowSvg("dark"),
  ]);
  const directory = path.join(process.cwd(), "public/docs-assets");
  mkdirSync(directory, { recursive: true });
  writeFileSync(path.join(process.cwd(), LIGHT_SVG), light);
  writeFileSync(path.join(process.cwd(), DARK_SVG), dark);
  process.stdout.write(`Wrote ${LIGHT_SVG} and ${DARK_SVG}\n`);
}
