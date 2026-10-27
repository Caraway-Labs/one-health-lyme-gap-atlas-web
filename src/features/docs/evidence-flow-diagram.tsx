import { Mermaid } from "@/components/docs-mermaid";
import {
  evidenceFlowAlt,
  evidenceFlowChart,
  evidenceFlowSteps,
} from "@/features/docs/evidence-flow";

function stepText(detail: string) {
  const parts = detail.split(/(?<code>`[^`]+`)/g);
  return parts.map((part, index) => {
    if (part.startsWith("`") && part.endsWith("`") && part.length > 2) {
      return <code key={`${index}-${part}`}>{part.slice(1, -1)}</code>;
    }
    return <span key={`${index}-text`}>{part}</span>;
  });
}

/** Provenance diagram plus the same steps in text. */
export function EvidenceFlowDiagram() {
  return (
    <Mermaid alt={evidenceFlowAlt} chart={evidenceFlowChart}>
      <figcaption>
        <ol>
          {evidenceFlowSteps.map((step) => (
            <li key={step.title}>
              <strong>{step.title}.</strong> {stepText(step.detail)}
            </li>
          ))}
        </ol>
      </figcaption>
    </Mermaid>
  );
}
