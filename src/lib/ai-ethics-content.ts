/**
 * Source of truth for the public AI Ethics page.
 *
 * Copy is deliberately classified so that a future UI cannot blur what Atlas
 * does now, what its approved architecture permits, and what still needs a
 * product decision. Update `version` and `lastUpdated` whenever substantive
 * public-facing text changes.
 */
export const aiEthicsContent = {
  version: "0.1.0",
  lastUpdated: "2026-09-07",
  maintenance: {
    review: "Ordinary pull-request review for this initial release.",
    updateRule:
      "Update the version and last-updated date when substantive public-facing copy changes.",
  },
  introduction: {
    title: "How Atlas approaches AI",
    summary:
      "This page explains what Atlas can say about artificial intelligence today, what is planned, and which commitments still need a product decision.",
    audienceNote:
      "It is written first for the public, with additional implementation detail for epidemiologists and other evidence users.",
  },
  statements: [
    {
      status: "current" as const,
      title: "Atlas prioritizes transparent, non-predictive scoring",
      summary:
        "The current Atlas score is a transparent, adjustable follow-up-priority calculation. It is not a predictive model.",
      detail:
        "The score helps users inspect where published surveillance information and other public evidence may warrant a closer look. It does not diagnose Lyme disease, predict an individual's risk, establish disease burden, or prove what caused an outcome.",
      evidence: "Current Atlas scoring UI and methodology language.",
    },
    {
      status: "approved-architecture" as const,
      title: "Evidence chat must be grounded in governed sources",
      summary:
        "The approved evidence-chat architecture is designed to answer from governed literature evidence, with citations and a clear unavailable-evidence outcome.",
      detail:
        "The architecture requires substantive claims to resolve to validated evidence passages and requires the service to fail closed when evidence is missing, unavailable, or timed out. Public enablement remains subject to the recorded live-acceptance process.",
      evidence: "Workspace ADR 0007: Knowledge Graph and Public Evidence Chat.",
    },
    {
      status: "pending-decision" as const,
      title: "Ethical commitments are still being defined",
      summary:
        "Atlas is publishing this initial explanation before final commitments are approved, so visitors can see both the direction of the work and the remaining decisions.",
      detail:
        "A pending decision is not a policy, safeguard, or promise. Atlas will update this page after each substantive decision is made and reviewed.",
      evidence: "AI Ethics epic #96 and content-baseline story #98.",
    },
  ],
  boundaries: [
    "Atlas is not a clinical service and does not provide diagnosis or treatment advice.",
    "Atlas does not present its score as a disease-risk prediction, causal conclusion, or proof of disease burden.",
    "An evidence-grounded answer is not a replacement for epidemiological, clinical, or public-health judgment.",
    "Planned capability is not described as a deployed feature or an existing commitment.",
  ],
  openCommitments: [
    {
      topic: "Human oversight and accountability",
      question:
        "Which AI-supported workflows require human review, and who is accountable when users identify a concern?",
    },
    {
      topic: "Clinical and public-health boundaries",
      question:
        "How should Atlas make its non-clinical role and appropriate uses unmistakable in every AI-supported experience?",
    },
    {
      topic: "Data use and model training",
      question:
        "What data, if any, may be used to improve AI capabilities, and what consent, retention, and exclusion rules will govern that use?",
    },
    {
      topic: "Bias, quality, and evaluation",
      question:
        "Which evaluations, thresholds, and review processes are required before AI-supported functionality can be released or changed?",
    },
    {
      topic: "Uncertainty and failure handling",
      question:
        "How will Atlas explain uncertainty, missing evidence, disagreement, and system limitations without overstating confidence?",
    },
    {
      topic: "Questions, feedback, and redress",
      question:
        "What path should users have to ask questions, report a concern, or seek correction when that scope is approved?",
    },
  ],
  relatedWork: [
    {
      topic: "Privacy and user data",
      detail:
        "Privacy, consent, and user-data commitments are governed separately. This page must not make new privacy promises before that work is approved.",
      issues: ["#88", "#94"],
    },
    {
      topic: "Evidence and assistant boundaries",
      detail:
        "Evidence/provenance and assistant safety vocabulary are defined in their own product work and must remain consistent with this page.",
      issues: ["#28", "#29"],
    },
  ],
} as const;

export type AiEthicsStatementStatus =
  (typeof aiEthicsContent.statements)[number]["status"];
