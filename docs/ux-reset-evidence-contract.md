# UX Reset evidence and provenance contract

**Story:** [issue #409](https://github.com/Caraway-Labs/one-health-lyme-gap-atlas-web/issues/409)  
**Parent epic:** [#394](https://github.com/Caraway-Labs/one-health-lyme-gap-atlas-web/issues/394)  
**Product rules:** follow [UX_RESET_CONSTITUTION.md](./UX_RESET_CONSTITUTION.md) when that document is on `main` (issue #407). This file defines the **implementation contract** only—do not restate the full constitution here.

## Purpose

Review, Explore, Investigate, and Compare under `/app/*` must present governed evidence with the same availability vocabulary, provenance cues, and progressive disclosure. The shared implementation lives in `src/features/ux-reset/evidence/`.

## Top-level availability

| Label | When to use |
| --- | --- |
| **Available** | Governed inputs exist for the claim at the stated geography and period; values may include an explicit published zero. |
| **Limited** | Signal exists but suppression, coverage, sample size, staleness, or documented limitations constrain interpretation. |
| **Unavailable** | Metadata or values are absent, invalid, or out of scope—Atlas does not guess and **never renders as numeric zero**. |

## Reason codes (governed `value_state` → UI)

API `value_state` is authoritative. The UI maps each code to an availability label and a short reason string (`evidenceReasonLabel`).

| `value_state`             | Availability | Reason label (default)          |
| ------------------------- | ------------ | ------------------------------- |
| `OBSERVED`                | Available    | Observed or published           |
| `ZERO`                    | Available    | Published zero                  |
| `SUPPRESSED`              | Limited      | Suppressed or privacy-protected |
| `MISSING`                 | Unavailable  | No county record                |
| `NO_COUNTY_LINKED_RECORD` | Unavailable  | No county-linked record         |
| `UNAVAILABLE`             | Unavailable  | Unavailable for this release    |

**Derived code (not an API enum):**

| Code | Availability | When |
| --- | --- | --- |
| `MATERIAL_LIMITATION` | Limited | `limitations[]` on the observation is non-empty while `value_state` is `OBSERVED` or `ZERO`. |

Future API reason/comparability metadata ([API #88](https://github.com/Caraway-Labs/one-health-lyme-gap-atlas-api/issues/88)) may extend this table; Reset V1 must not invent browser-derived semantics when governed fields are missing.

## Display value rules

Use `formatGovernedEvidenceValue`:

- `MISSING`, `UNAVAILABLE`, and `NO_COUNTY_LINKED_RECORD` → display **Unavailable** even if `value` is `0` or `null`.
- `ZERO` with a numeric zero → format `0` (and unit when provided).
- `SUPPRESSED` → display **Suppressed**, not a numeric substitute.

## Components

| Component | Role |
| --- | --- |
| `EvidenceObject` | Claim label, governed display value, strip, and provenance inspect action. |
| `EvidenceStateStrip` | Availability badge plus source family, observation period, evidence type, and optional material caveat. |
| `ReleaseEvidenceStateStrip` | Release-level snapshot shared across pages (from `AtlasMetadata`). |
| `EvidenceProvenanceInspect` | One-action `<details>` for human-readable provenance; technical IDs are nested and documentation-linked. |

## Builders

| Function | Input |
| --- | --- |
| `evidenceObjectFromObservation` | Canonical `Observation` + claim label |
| `releaseEvidenceContextFromMetadata` | `AtlasMetadata` for page-level release strip |

## Page usage (Reset V1)

| Destination | Typical use |
| --- | --- |
| **Review** | `ReleaseEvidenceStateStrip` + row-level `EvidenceObject` for ranked measures. |
| **Explore** | `ReleaseEvidenceStateStrip` + `EvidenceObject` on map/table selection. |
| **Investigate** | Multiple `EvidenceObject` rows for county bundle claims. |
| **Compare** | Aligned `EvidenceObject` instances per county/measure column. |

Legacy county panels may keep micro-state copy until migrated; new Reset routes must import this contract.

## Tests

`tests/ux-reset-evidence-contract.test.tsx` locks availability mapping, display-value guardrails, and component rendering.
