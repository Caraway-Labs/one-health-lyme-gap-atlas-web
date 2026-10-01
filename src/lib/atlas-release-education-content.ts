/**
 * Public-health interpretation copy for Atlas release and methodology labels.
 *
 * Update `version` and `lastUpdated` when substantive wording changes. Record
 * owner review in `ownerReview` before merging interpretation updates.
 */
export const atlasReleaseEducationContent = {
  version: "1.0.0",
  lastUpdated: "2026-09-30",
  ownerReview: {
    recordedAt: "2026-09-30",
    reviewers: ["Public-health interpretation owner, Caraway Labs"],
    trackingIssue: "336",
    scope:
      "Release-semantics dictionary and methodology explainer shown on Overview and Geographic Explorer.",
  },
  introduction:
    "Atlas combines published One Health inputs into a governed county release. The labels below describe what you are viewing—not individual risk, disease burden, or where exposure occurred.",
  releaseSemantics: [
    {
      term: "Evidence snapshot",
      definition:
        "A short summary of the active governed release: which counties are in scope, which source periods feed the release, and which scoring methodology version produced the county review score.",
    },
    {
      term: "Selected release",
      definition:
        "The governed county bundle you are viewing. Atlas assembles inputs that passed release checks into one comparable county table. The human-readable label describes when that bundle was assembled; it is not a surveillance observation date.",
    },
    {
      term: "Evidence scope",
      definition:
        "The geography and coverage boundary for this release—for example, which counties are included or excluded. Scope comes from governed metadata; Atlas does not expand it beyond what the release documents.",
    },
    {
      term: "Source periods",
      definition:
        "The observation, reporting, or publication periods attached to each upstream source in this release (for example, a surveillance table vintage). These periods describe the underlying public inputs, not when Atlas generated or loaded the release.",
    },
    {
      term: "Scoring methodology",
      definition:
        "The versioned rules Atlas uses to combine released inputs into the county review score and related derived measures. Methodology version is separate from source periods and from release assembly time.",
    },
    {
      term: "Release generated",
      definition:
        "When Atlas finished building this governed release bundle from approved inputs. It is a processing timestamp for the release artifact, not the date cases were observed or published by a surveillance authority.",
    },
    {
      term: "Release loaded",
      definition:
        "When this release became available through the public Atlas API the application is reading. Load time can differ from generation time when a bundle is promoted or cached.",
    },
    {
      term: "Methodology version (technical ID)",
      definition:
        "A stable identifier for the scoring rules used in this release. Use it to confirm you are comparing counties produced under the same methodology. The plain-language methodology label above is derived from this ID; when metadata is missing, Atlas shows Unavailable rather than guessing.",
    },
    {
      term: "Release ID (technical ID)",
      definition:
        "A stable identifier for the governed county bundle. Use it in support requests, exports, and reproducible links. It may encode an assembly date; that date still means when the bundle was built, not a source observation period.",
    },
  ],
  methodologyExplainer: {
    title: "How county scoring works in this release",
    sections: [
      {
        heading: "What the review score is",
        body: "The county review score is a derived follow-up-priority measure. It helps epidemiologists see where published Lyme surveillance, tick and pathogen evidence, and selected contextual inputs may warrant a closer look together. It is not a diagnosis, an individual exposure estimate, proof of underreporting, or a prediction of future cases.",
      },
      {
        heading: "What changes between methodology labels",
        body: "Deterministic scoring methodology applies fixed, inspectable rules to the released inputs. Semantic scoring methodology applies the same transparency goals with a newer ruleset identified in governed metadata. Always compare counties within one active release and one methodology version; mixing versions can change rankings even when source periods look similar.",
      },
      {
        heading: "Keep time concepts separate",
        body: "Source periods describe what upstream publishers reported. Release generated and loaded times describe Atlas processing and delivery. Methodology version describes how inputs were combined. None of these timestamps should be read as the date Lyme activity occurred in a county.",
      },
      {
        heading: "Missing metadata stays unavailable",
        body: "If a timestamp, identifier, or source vintage is absent or invalid, Atlas shows Unavailable. The application does not infer retrieval dates, fill gaps with defaults, or hide technical IDs—open the technical disclosure on this page when you need exact values for reproducibility.",
      },
    ],
  },
} as const;

export type ReleaseSemanticEntry =
  (typeof atlasReleaseEducationContent.releaseSemantics)[number];
