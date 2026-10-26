import Image from "next/image";
import type { ReactNode } from "react";

import { evidenceFlowChart } from "@/features/docs/evidence-flow";

const LIGHT_DIAGRAM = "/docs-assets/evidence-flow-light.svg";
const DARK_DIAGRAM = "/docs-assets/evidence-flow-dark.svg";

type MermaidProps = {
  /** Accessible name. A fenced diagram can put this in a `%% alt:` comment. */
  alt?: string;
  chart: string;
  children?: ReactNode;
};

/**
 * Renders a Mermaid chart that was drawn at build time. Fumadocs
 * `remarkMdxMermaid` turns mermaid fences into this component.
 */
export function Mermaid({ alt, chart, children }: MermaidProps) {
  const normalized = chart.trim();
  const commentAlt = altFromComment(normalized);
  const accessibleName = alt ?? commentAlt;
  if (normalized.replace(ALT_COMMENT, "").trim() !== evidenceFlowChart) {
    throw new Error(
      "This Mermaid chart has no build-time SVG. Run the evidence-flow renderer."
    );
  }
  if (!accessibleName) {
    throw new Error("Mermaid diagrams require alt text.");
  }
  return (
    <figure className="docs-mermaid">
      <Image
        alt={accessibleName}
        className="docs-mermaid-light"
        height={300}
        src={LIGHT_DIAGRAM}
        unoptimized
        width={184}
      />
      <Image
        alt={accessibleName}
        className="docs-mermaid-dark"
        height={300}
        src={DARK_DIAGRAM}
        unoptimized
        width={184}
      />
      {children}
    </figure>
  );
}

const ALT_COMMENT = /^%%\s*alt:\s*(?<alt>.+)$/m;

function altFromComment(chart: string): string | undefined {
  const alt = ALT_COMMENT.exec(chart)?.groups?.alt?.trim();
  return alt && alt.length > 0 ? alt : undefined;
}
