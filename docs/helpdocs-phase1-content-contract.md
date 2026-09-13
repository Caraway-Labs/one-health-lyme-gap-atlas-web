# Phase 1 HelpDocs content contract

Status: Accepted for Phase 1 implementation  
Owner: Atlas product and documentation leads, with epidemiology/scientific review  
Last reviewed: 2026-09-13

This contract turns the Atlas product vision and technical charter into the information architecture and editorial rules for the public Fumadocs HelpDocs. It is intentionally a content contract; it does not change an API, data contract, score, model, authentication decision, or deployment topology.

## User outcome

A first-time epidemiologist or adjacent public-health user should be able to understand, without reading repository documentation:

1. what Atlas Lyme is and who it is for;
2. what the current public release can help them do;
3. how to move from a question to an evidence-aware investigation step; and
4. what Atlas cannot establish or decide for them.

## Canonical message hierarchy

- Product category: **Epidemiologist Decision Intelligence Platform**.
- Product scope: a disease-focused public-health decision-intelligence platform for Lyme disease and other tick-borne diseases.
- Vision: **From fragmented surveillance data to timely, interpretable, evidence-backed public-health action.**
- North Star: **A system that identifies what matters, explains why it matters, communicates uncertainty, and helps epidemiologists decide what deserves investigation.**
- Mechanism: integrate disparate One Health evidence, surface patterns and context, and support investigation.
- Outcome: less manual analysis, earlier recognition of emerging risk, and more defensible public-health decisions.

Use “signal,” “evidence,” “hypothesis,” “anomaly candidate,” and “investigation priority” for analytical outputs. Do not describe Atlas as an autonomous AI agent, clinical service, outbreak oracle, or replacement for expert judgment.

## Phase 1 navigation

```text
START HERE
  Start with Atlas Lyme
  What Atlas Lyme is
  Who Atlas is for
  Atlas workflow: data to investigation

USE ATLAS
  Current capabilities
  Explore geographies
  Compare and share findings

UNDERSTAND THE EVIDENCE
  Evidence and signals
  Provenance and freshness
  Uncertainty and surveillance gaps
  What Atlas outputs mean

AI AND DECISION INTELLIGENCE
  AI in Atlas
  Current versus planned capabilities

TRUST AND SUPPORT
  Responsible use
  FAQ and troubleshooting
```

Page names may be refined as implementation proceeds, but product orientation must be discoverable before deep technical detail.

## Capability-status vocabulary

Every capability claim uses one of these statuses:

- **Available now:** verified in the current public production release.
- **In development or planned:** approved direction that is not yet available to public users.
- **Experimental/demo:** feature-gated, fixture-only, or otherwise not a production intelligence capability.
- **Not supported:** outside the current product contract.

Capability status must be reviewed against the current routes and deployment before publishing. A roadmap statement is not evidence that a capability is available.

## Evidence and interpretation rules

Evidence-oriented pages must retain an accessible path to the applicable source/provenance, publisher or release, retrieval/load context, geography, time period or vintage, methodology/model version, freshness, limitations, coverage, sample-size context, and uncertainty. They must preserve the distinction among zero, null, missing, suppressed, unavailable, stale, sparse, and not-reported values where those states exist.

Do not infer disease burden from data availability. Do not turn an observed or derived signal into a diagnosis, causal claim, guaranteed outbreak prediction, or individual risk assessment.

Map-oriented guidance must point to the equivalent table, text, or structured result path. Users must not need visual map interpretation alone to access key findings.

## Review checklist

Before a Phase 1 page is released, review:

- product wording and capability status against the current public release;
- scientific/public-health interpretation and prohibited overclaiming;
- provenance, freshness, geography, methodology, limitation, and uncertainty context;
- meaningful missingness and non-map parity;
- heading structure, keyboard access, links, search metadata, and responsive readability; and
- page owner, last-reviewed date, and links that are expected to remain stable.

The accepted [Atlas documentation ADR](adr/0020-atlas-documentation-site.md) defines the Fumadocs hosting and runtime boundary. The [Atlas product vision and technical charter](https://github.com/Caraway-Labs/one-health-lyme-gap-atlas-web/wiki/Atlas-Lyme:-Product-Vision,-Platform-Class,-and-Technical-Charter) defines the product direction this contract explains for users.
