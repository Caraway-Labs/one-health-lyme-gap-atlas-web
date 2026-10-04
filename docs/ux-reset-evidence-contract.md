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
- `OBSERVED` small nonzero values keep precision (for example `0.0001 mm`, not `0 mm`).
- Decimal strings keep full precision and append units when missing from the string.
- `SUPPRESSED` → display **Suppressed**, not a numeric substitute.

**Observation period vs dataset vintage:** `observationPeriod` comes from `period_start`, `period_end`, and `temporal_grain` (only full calendar-year intervals collapse to a single year). `datasetVintage` comes from governed `source_vintage` only; when absent, the strip omits the row and inspect does not invent a vintage. `semantic_version` is the API semantic-contract version, not dataset vintage—do not map it to dataset vintage.

**Limitations:** the strip may show the first limitation as a short caveat; **Inspect provenance** lists every governed limitation.

**Evidence type:** use governed `Measure.measure_type` when the page has resolved catalog metadata. Do not infer from `evidence.resource_type`, resource IDs, or labels; show **Unavailable** when `measure_type` is absent.

## Components

| Component | Role |
| --- | --- |
| `EvidenceObject` | Claim label, governed display value, strip, and provenance inspect action. |
| `EvidenceStateStrip` | Availability badge plus source family, observation period, dataset vintage (when present), evidence type, and optional short caveat (first limitation). |
| `ReleaseEvidenceStateStrip` | Release-level snapshot shared across pages (from `AtlasMetadata`). Uses `loadState` for **loading** and **error** copy—those are not evidence **Unavailable** states. |
| `EvidenceProvenanceInspect` | One-action `<details>` for human-readable provenance; technical IDs are nested and documentation-linked. |

## Builders

| Function | Input |
| --- | --- |
| `evidenceObjectFromObservation` | Canonical `Observation` + claim label; optional governed `Measure.measure_type` for evidence type |
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
