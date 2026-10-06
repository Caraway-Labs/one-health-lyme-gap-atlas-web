/**
 * Authenticated AI / Responsible Use copy (issue 433).
 * Maturity labels describe capability status. They are separate from evidence
 * availability (Available / Limited / Unavailable).
 *
 * `support` records the deployed surface or owning contract for review.
 * Merged code or an open epic is not enough to mark a claim Current.
 */
export { RESET_AI_RESPONSIBLE_USE_PATH as AI_RESPONSIBLE_USE_PATH } from "@/features/ux-reset/routes";

export const aiResponsibleUseContent = {
  version: "1.0.0",
  lastUpdated: "2026-10-05",
  title: "AI / Responsible Use",
  summary:
    "Atlas uses analytical rules and a narrow set of AI-assisted tools to help people decide what deserves investigation. People remain responsible for interpretation. This page states which of those tools you can use today, which are limited, and which are not released. Methods, API detail, and evidence interpretation stay in Docs.",
  maturityNote:
    "The four labels below are capability maturity. They are separate from the evidence labels Available, Limited, and Unavailable, which describe a governed value after a successful response.",
} as const;

export const capabilityMaturities = [
  "current",
  "experimental",
  "in-development",
  "planned",
] as const;

export type CapabilityMaturity = (typeof capabilityMaturities)[number];

export type MaturityDefinition = {
  definition: string;
  maturity: CapabilityMaturity;
};

export const maturityDefinitions: readonly MaturityDefinition[] = [
  {
    maturity: "current",
    definition:
      "Released in Atlas and appropriate to use, within the limits stated here.",
  },
  {
    maturity: "experimental",
    definition:
      "Present only when a deployment switch or limited path is on. It is not a general commitment.",
  },
  {
    maturity: "in-development",
    definition:
      "Being built beside the released workspace. You cannot rely on it from this site.",
  },
  {
    maturity: "planned",
    definition:
      "Product direction only. Atlas does not provide this behavior today.",
  },
];

export function maturityLabel(maturity: CapabilityMaturity): string {
  switch (maturity) {
    case "current": {
      return "Current";
    }
    case "experimental": {
      return "Experimental";
    }
    case "in-development": {
      return "In development";
    }
    case "planned": {
      return "Planned";
    }
    default: {
      const exhaustive: never = maturity;
      return exhaustive;
    }
  }
}

export type WorkKind = {
  definition: string;
  id: string;
  term: string;
};

export const workKinds: readonly WorkKind[] = [
  {
    id: "observed",
    term: "Observed",
    definition:
      "A value published by an approved source, such as a county-linked surveillance count or a tick or pathogen status.",
  },
  {
    id: "derived",
    term: "Derived",
    definition:
      "A calculation over released inputs, such as the county review score. The released score uses versioned, inspectable rules.",
  },
  {
    id: "modeled",
    term: "Modeled",
    definition:
      "An estimate, forecast, or classification produced by a model. Atlas does not publish a modeled outbreak forecast or an individual-risk score.",
  },
  {
    id: "ai-generated",
    term: "AI-generated",
    definition:
      "Text produced by a model, such as an Ask Atlas answer when literature chat is enabled. An answer is a prompt for review, with citations or an explicit gap.",
  },
  {
    id: "human-reviewed",
    term: "Human-reviewed",
    definition:
      "A person decides what to investigate and whether a recommendation is worth follow-up. Atlas leaves that decision with the reader.",
  },
];

export type CapabilityClaim = {
  boundary: string;
  docHref: string;
  docLabel: string;
  id: string;
  maturity: CapabilityMaturity;
  statusBasis: string;
  summary: string;
  support: string;
  title: string;
};

export const capabilityClaims: readonly CapabilityClaim[] = [
  {
    id: "review-priority",
    maturity: "current",
    title: "County review priority",
    summary:
      "The county review score is a derived follow-up-priority measure. It combines published surveillance and other released inputs with versioned rules so a reviewer can see where a closer look may be warranted. The public Explorer and the signed-in Review page both show this score.",
    boundary:
      "The score is a rules-based calculation. It is a follow-up priority for investigation. It is not a machine-learning model, a diagnosis, a disease-burden estimate, an individual exposure score, or a forecast of future cases.",
    statusBasis:
      "The released Explorer, Geographic Explorer, and professional Review surfaces show this score. The methodology guide describes deterministic and semantic scoring rules.",
    support:
      "Deployed scoring UI and governed score API. Contract: content/docs/releases-and-methodology.mdx; content/docs/ai-enabled-decision-intelligence.mdx (Transparent follow-up-priority scoring); src/lib/atlas-release-education-content.ts (web issue 336).",
    docHref: "/docs/releases-and-methodology",
    docLabel: "Releases and methodology",
  },
  {
    id: "ml-prioritization",
    maturity: "planned",
    title: "Machine-learning prioritization and forecasts",
    summary:
      "A future validated model may help explain unusual patterns or add modeled context to a review. That model is not in the released product.",
    boundary:
      "No current score, map color, or rank is a machine-learning prediction. Atlas does not forecast outbreaks, predict individual risk, or prove what caused an outcome.",
    statusBasis:
      "Docs list anomaly candidates and interpretable modeling as planned. This web application does not ship a forecast endpoint or a model card.",
    support:
      "Owning contract: content/docs/ai-enabled-decision-intelligence.mdx row “Anomaly candidates and interpretable modeling | Planned”; content/docs/evidence-and-uncertainty.mdx modeled-output row. Source intent: web issue 393. No deployed forecast capability.",
    docHref: "/docs/ai-enabled-decision-intelligence",
    docLabel: "AI-enabled decision intelligence",
  },
  {
    id: "ask-atlas-literature",
    maturity: "experimental",
    title: "Ask Atlas literature questions",
    summary:
      "On Review, Explore, Investigate, Compare, and Action, Ask Atlas can send a question to a reviewed PubMed and PMC Open Access literature service when that service is enabled. The answer includes cited evidence or an explicit unavailable-evidence outcome. You stay on the page, and you choose where to go next. Open full workspace continues that same browser-local conversation.",
    boundary:
      "The request is a message plus optional conversation history. There is no Structured mode and no mixed mode over Atlas geography or scores. When literature chat is off, the panel and /app/assistant say Ask Atlas is unavailable. That is a service state, not the evidence label Unavailable. Ask Atlas does not change filters, maps, or the address, and it does not run a workflow. The public /assistant route uses the same literature service when the same switch is on. Saved chats stay in this browser.",
    statusBasis:
      "The workspace sidecar and /app/assistant research workspace are deployed and gated by the literature-chat switch. Product docs classify them as experimental, not as a general release.",
    support:
      "Deployed sidecar and workspace: src/features/ux-reset/ask-atlas/ask-atlas-chrome.tsx, src/features/ux-reset/ask-atlas/ask-atlas-workspace.tsx, gate NEXT_PUBLIC_KG_CHAT_ENABLED, API POST /v1/knowledge-graph/chat. Contract: content/docs/professional-workspace.mdx (Ask Atlas); content/docs/ai-enabled-decision-intelligence.mdx (Experimental/demo); constitution issue 426 answer-only rule. The feature gate and docs keep this Experimental.",
    docHref: "/docs/professional-workspace",
    docLabel: "Professional workspace",
  },
  {
    id: "ask-atlas-structured",
    maturity: "planned",
    title: "Structured or mixed Ask Atlas",
    summary:
      "Questions that combine governed Atlas data with literature, or that use a structured answer mode, are part of the product direction.",
    boundary:
      "The panel and the /app/assistant workspace do not query live Atlas geography or scores, and they do not offer a Structured or Both mode. They are not an autonomous assistant.",
    statusBasis:
      "Docs list the broader Atlas evidence assistant as planned. The deployed panel and research workspace document the absence of Structured and Both modes.",
    support:
      "Owning contract: content/docs/ai-enabled-decision-intelligence.mdx row “Broader Atlas evidence assistant | Planned”; content/docs/current-capabilities.mdx. Do not treat web issue 426 or the workspace page as a structured-mode release.",
    docHref: "/docs/ai-enabled-decision-intelligence",
    docLabel: "AI-enabled decision intelligence",
  },
  {
    id: "dataset-discovery",
    maturity: "in-development",
    title: "Dataset discovery recommendations",
    summary:
      "A separate Dataset Discovery application can draft a recommendation about a cataloged dataset and explain why a person might investigate it. Operator-started development and shadow runs exist. They are not a feature of this workspace.",
    boundary:
      "The application recommends. A person reviews. Accepting a recommendation means “investigate this source.” It does not approve the source, start ingestion, or publish evidence. Rights, quality, lineage, and the governed onboarding workflow remain authoritative. Scheduling is not an always-on production service.",
    statusBasis:
      "The Dataset Discovery repository records development and shadow runs and states that those records do not establish production readiness. This site does not expose the recommendations.",
    support:
      "Owning work: one-health-lyme-gap-atlas-dataset-discovery epic #5 (open) and ADR 0001; data issues 449 and 450 for Snowflake objects and governed onboarding. Repository readiness text: merged code and historical DEV/SHADOW receipts do not establish PROD readiness. Human-only handoff. Not a released carawaylabs.com capability.",
    docHref: "/docs/ai-enabled-decision-intelligence",
    docLabel: "AI-enabled decision intelligence",
  },
  {
    id: "ingestion-assistance",
    maturity: "planned",
    title: "AI assistance during ingestion",
    summary:
      "Publishing evidence still follows deterministic ingestion and human governance. Model-assisted extraction, classification, or an agent that loads a dataset into Atlas is not a released workflow.",
    boundary:
      "Deterministic data engineering and AI stay separate. An AI suggestion does not publish a source. A development MCP server can report its own status. Production Atlas-data MCP is not available.",
    statusBasis:
      "Docs list literature monitoring and agent assistance as planned. Dataset Discovery does not own catalog ingestion.",
    support:
      "Owning contract: content/docs/ai-enabled-decision-intelligence.mdx row “Literature monitoring or agent assistance | Planned”; content/docs/api-mcp-and-access.mdx. Dataset Discovery README: that application does not own deterministic Atlas catalog ingestion.",
    docHref: "/docs/api-mcp-and-access",
    docLabel: "API, MCP, and access",
  },
];

export const governanceBoundaries = {
  maturity: "current" as const,
  title: "Boundaries that stay in force",
  summary:
    "These limits apply to every analytical and AI-assisted output on Atlas, including experimental ones.",
  items: [
    "Atlas does not diagnose Lyme disease or provide treatment advice.",
    "Atlas does not predict an individual’s exposure, infection, or disease risk.",
    "Atlas does not guarantee that an outbreak will or will not occur.",
    "Atlas does not prove that a vector, pathogen, environment, or population factor caused an outcome.",
    "Atlas does not turn missing surveillance into evidence of absence or zero.",
    "Atlas does not make a public-health decision or replace professional judgment.",
    "An AI-generated answer does not approve a source or change the workspace for you.",
  ],
  support:
    "Current product boundaries: docs/UX_RESET_CONSTITUTION.md; content/docs/ai-enabled-decision-intelligence.mdx “What Atlas AI is not for”; public /ai-ethics boundaries. Privacy commitments stay on /privacy (web issue 432).",
} as const;

export type DocumentationLink = {
  href: string;
  label: string;
  opensNewTab: boolean;
};

export const documentationLinks: readonly DocumentationLink[] = [
  {
    href: "/docs/ai-enabled-decision-intelligence",
    label: "AI-enabled decision intelligence",
    opensNewTab: true,
  },
  {
    href: "/docs/evidence-and-uncertainty",
    label: "Evidence, provenance, and uncertainty",
    opensNewTab: true,
  },
  {
    href: "/docs/releases-and-methodology",
    label: "Releases and methodology",
    opensNewTab: true,
  },
  {
    href: "/docs/current-capabilities",
    label: "Current capabilities",
    opensNewTab: true,
  },
  {
    href: "/docs/professional-workspace",
    label: "Professional workspace",
    opensNewTab: true,
  },
  {
    href: "/docs/api-mcp-and-access",
    label: "API, MCP, and access",
    opensNewTab: true,
  },
  {
    href: "/ai-ethics",
    label: "Public AI Ethics commitments",
    opensNewTab: false,
  },
  {
    href: "/privacy",
    label: "Privacy",
    opensNewTab: false,
  },
];
