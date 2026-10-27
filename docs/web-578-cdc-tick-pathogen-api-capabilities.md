# WEB #578 — Governed CDC tick and pathogen API capability brief

Handoff for a product/design teammate. This inventory describes the existing public CDC tick and pathogen API. It records verified request shapes, live responses, dated production receipts, and open API gaps. It does not choose page placement, layout, components, wording, interactions, or visual hierarchy, and it does not change the Web client.

Parent: [WEB #397](https://github.com/Caraway-Labs/one-health-lyme-gap-atlas-web/issues/397). Story: [WEB #578](https://github.com/Caraway-Labs/one-health-lyme-gap-atlas-web/issues/578).

Verification date: **2026-10-17**. Anonymous HTTPS only. Hosts checked: `https://api.onehealthatlas.org` and `https://api.carawaylabs.com`. Both served the same OpenAPI document, SHA-256 `112cb300663f4e8dfd82f48106dd312243c4c2fdeb1aa52b9921d81e276f131b` (130,274 bytes).

Current public metadata release, from `GET /v1/atlas/metadata` on that date: `governed-2026-10-15-january-climate-prod`, `schema_version` `2.0.0`, `generated_at` `2026-10-15T13:51:25.324973-07:00`, `loaded_at` `2026-10-15T14:08:33.953000-07:00`, `scope` `US_COUNTIES`.

Examples below use lower-48 county FIPS only. No lower-48 example exists for excluded `UNKNOWN_SOURCE_COVERAGE`. The API #228 production receipt says all 35 excluded rows per measure are outside the lower 48. This brief does not supply a substitute county.

## How to read the two evidence dates

Two layers are kept separate:

| Layer | What it is |
| --- | --- |
| **Live on 2026-10-17** | Responses retrieved for this brief. Source, measure, and indicator reads returned HTTP 200. Every cumulative CDC observation read tried here returned public HTTP 504 HTML. |
| **Receipt on 2026-10-12** | Sanitized HTTP 200 observation excerpts already published on [WEB #578](https://github.com/Caraway-Labs/one-health-lyme-gap-atlas-web/issues/578#issuecomment-6119207170) and [API #88](https://github.com/Caraway-Labs/one-health-lyme-gap-atlas-api/issues/88#issuecomment-6115665615), for release `governed-2026-10-06-nlcd-demo-cohort`. Those bodies were **not** returned again on 2026-10-17. |

## 1. Live endpoints and parameters

Authoritative operation text is the live OpenAPI above (`openapi` 3.1.0, title `One Health Lyme Gap Atlas API`, version `0.1.0`). Ordinary public reads are anonymous.

`GET /v1/sources/tick` and `GET /v1/sources/pathogen` are lookups on `GET /v1/sources/{source_id}`. The keys `tick` and `pathogen` are public catalog source ids. The operation says an unknown id returns HTTP 404 `RESOURCE_NOT_FOUND`.

### `GET /v1/observations`

Operation id: `listObservations`.

Live description, abbreviated to the CDC sentence and the shared rules around it: surveillance context is optional and requires an admitted Data delivery; `normalized_state` preserves Data semantics and the publisher value remains `value`. Separately enabled CDC status uses `start_date=end_date=2025-12-31` and `CUMULATIVE` grain; `scapularis_status` and `burgdorferi_status` require exact Data record admission. Annual `year` and other date ranges return HTTP 400 `UNSUPPORTED_FILTER` before data access. Missing context carries no absence or temporal-comparability claim. A measure and a bounded county/time selection are required. The API does not offer user sorting or aggregation. Results are ordered by measure id, county FIPS, period start, and observation id. Opaque page tokens bind to filters and release.

| Parameter | Required | Live contract |
| --- | --- | --- |
| `measure_id` | yes | Exact discovery measure id. For this brief: bare `scapularis_status` or `burgdorferi_status`. `1.0.0` is a semantic version, not an id suffix. |
| `geography_type` | yes | `county` or `state`. These CDC records are county records. |
| `geography_id` | yes | Array of 1–500 geography ids. County ids are five-digit FIPS strings; leading zeros are significant. Repeating the query parameter is the live form. |
| `start_date` | no in the schema; required for this CDC read | Inclusive date. CDC cumulative reads use `2025-12-31` together with `end_date`. |
| `end_date` | paired with `start_date` | Inclusive date. Same CDC value: `2025-12-31`. |
| `year` | no | Annual year **or** a complete date range. The live parameter text says CDC cumulative status rejects `year`. |
| `vintage_year` | no | Used by other county-context measures. Not part of the CDC cumulative query. |
| `stratification` | no | Live text: the current release has no strata; unsupported selections fail explicitly. |
| `page_size` | no | Integer 1–500. Default 100. |
| `page_token` | no | Opaque `next_page_token`. Reuse it with the same filters and release. Null means the collection is exhausted. Tokens may expire on restart. |

Documented success body: `CollectionEnvelope[Observation]` with `data`, `meta` (`next_page_token`, `response_at`), and `links.self`. `response_at` is UTC response construction time, not source freshness.

Documented error media type: `application/problem+json` (`ProblemDetails`: `type`, `title`, `status`, `detail`, `instance`, `request_id`, optional `code`, optional `errors`). Observation status codes in the live document include 200, 400, 404, 413, 414, 429, and 503.

### Discovery and source lookups

| Method and path | Role for this brief |
| --- | --- |
| `GET /v1/measures` | Current-release measure list. `page_size` default 100, maximum 500. |
| `GET /v1/measures/{measure_id}` | One measure. Unknown id: HTTP 404. |
| `GET /v1/indicators` and `GET /v1/indicators/{indicator_id}` | Indicator membership for the measures. |
| `GET /v1/sources` | Current-release source list. |
| `GET /v1/sources/{source_id}` | One source. Cache-Control on the live operation: `public, max-age=60, must-revalidate`. Matching `If-None-Match` returns an empty HTTP 304. |
| `GET /v1/methodologies/{methodology_id}` | Present in the live document. Both CDC measure payloads retrieved below have `methodology_id: null`, so there is no methodology resource id to call. |

## 2. Live HTTP 200 resources (2026-10-17)

`GET /v1/measures?page_size=100` returned HTTP 200, 25 measures, `next_page_token` null. The page includes `scapularis_status`, `burgdorferi_status`, and `pacificus_status`.

`GET /v1/sources?page_size=100` returned HTTP 200, 6 sources, `next_page_token` null. The page includes `tick` and `pathogen`.

Exact lookups below are complete public bodies from `https://api.onehealthatlas.org` on 2026-10-17. Nulls are the API's nulls.

### Measures

`GET /v1/measures/scapularis_status` — HTTP 200, 5,973 ms. ETag `9c057d4a6c8697c0433a048cb34857a1fc6e8e8c11142f0cbd79f46231d3f16f`.

```json
{
  "data": {
    "measure_id": "scapularis_status",
    "indicator_id": "tick_surveillance",
    "label": "Ixodes scapularis status",
    "definition": null,
    "semantic_version": "2.0.0",
    "release_version": "governed-2026-10-15-january-climate-prod",
    "measure_type": "string",
    "unit": "status",
    "denominator": null,
    "geography_types": null,
    "temporal_grains": null,
    "geography_semantics": "COUNTY_FIPS_5",
    "temporal_semantics": "as published",
    "allowed_value_states": null,
    "allowed_strata": null,
    "missingness_semantics": "No records is not absence.",
    "methodology_id": null,
    "methodology": "source-native status mapping",
    "source_ids": null,
    "limitations": ["Not abundance or individual risk."],
    "standards_mappings": null
  }
}
```

`GET /v1/measures/burgdorferi_status` — HTTP 200, 5,702 ms. ETag `6fd92375a737558ce0e867b938b9a62360ee50a404ca8164b39ff19020fd8b77`.

```json
{
  "data": {
    "measure_id": "burgdorferi_status",
    "indicator_id": "pathogen_surveillance",
    "label": "Borrelia burgdorferi status",
    "definition": null,
    "semantic_version": "2.0.0",
    "release_version": "governed-2026-10-15-january-climate-prod",
    "measure_type": "string",
    "unit": "status",
    "denominator": null,
    "geography_types": null,
    "temporal_grains": null,
    "geography_semantics": "COUNTY_FIPS_5",
    "temporal_semantics": "as published",
    "allowed_value_states": null,
    "allowed_strata": null,
    "missingness_semantics": "No records is not absence.",
    "methodology_id": null,
    "methodology": "distinct pathogen mapping",
    "source_ids": null,
    "limitations": ["Not individual infection risk."],
    "standards_mappings": null
  }
}
```

### Indicators

`GET /v1/indicators/tick_surveillance` — HTTP 200. `measure_ids` are `pacificus_status` and `scapularis_status`. Label: `Tick surveillance`. Definition: `County tick status by species.` Limitation: `No records is not absence; status is not abundance or individual risk.` `semantic_version` `2.0.0`. `release_version` `governed-2026-10-15-january-climate-prod`. `domain`, `category`, and `standards_mappings` are null.

`GET /v1/indicators/pathogen_surveillance` — HTTP 200. `measure_ids` is `burgdorferi_status` only. Label: `Tickborne pathogen surveillance`. Definition: `Distinct pathogen status observations.` Limitation: `Pathogen status is not individual infection risk or diagnosis.` Same semantic version and release version. `domain`, `category`, and `standards_mappings` are null.

`pacificus_status` is on the tick indicator. This brief does not inventory that measure.

### Sources

`GET /v1/sources/tick` — HTTP 200, 5,591 ms. ETag `35597404cf48e13abd9793ad51d205da1d6e639eb083e80b7a072e3c86c4749c`.

```json
{
  "data": {
    "source_id": "tick",
    "label": "CDC ArboNET county tick status",
    "publisher": null,
    "lineage_source_id": "cdc_arbonet_tick_module",
    "dataset_id": "cdc-ixodes-county-status-2025",
    "semantic_version": "2.0.0",
    "release_version": "governed-2026-10-15-january-climate-prod",
    "source_url": "https://www.cdc.gov/ticks/data-research/facts-stats/tick-surveillance-data-sets.html",
    "source_vintage": "through 2025-12-31",
    "source_version": null,
    "published_at": null,
    "atlas_acquired_at": null,
    "upstream_updated_at": null,
    "source_retrieved_at": null,
    "limitations": [
      "Tick status is cumulative surveillance evidence; no records is not absence and status is not abundance, pathogen prevalence, diagnosis, or individual risk."
    ]
  }
}
```

`GET /v1/sources/pathogen` — HTTP 200, 5,487 ms. ETag `5e0341d1d7d367b7a2a4b4992343cfad1484f1a866510251651deb0f8410b7e2`.

```json
{
  "data": {
    "source_id": "pathogen",
    "label": "CDC ArboNET tickborne pathogen status",
    "publisher": null,
    "lineage_source_id": "cdc_arbonet_tick_module",
    "dataset_id": "cdc-ixodes-pathogen-status-2025",
    "semantic_version": "2.0.0",
    "release_version": "governed-2026-10-15-january-climate-prod",
    "source_url": "https://www.cdc.gov/ticks/data-research/facts-stats/tick-surveillance-data-sets.html",
    "source_vintage": "through 2025-12-31",
    "source_version": null,
    "published_at": null,
    "atlas_acquired_at": null,
    "upstream_updated_at": null,
    "source_retrieved_at": null,
    "limitations": [
      "This is a distinct restricted pathogen source. No records is not absence; 33 absent canonical counties are classified as unknown source coverage."
    ]
  }
}
```

`published_at` and `atlas_acquired_at` are deprecated on the live `Source` schema and are null here. `publisher`, `source_version`, `upstream_updated_at`, and `source_retrieved_at` are also null. The limitation text is the only place the live pathogen source states a count of absent canonical counties. See the contradictions section before treating `33` as the producer exclusion count.

## 3. Live CDC observation reads (2026-10-17)

Each request used `geography_type=county`, `start_date=2025-12-31`, `end_date=2025-12-31`, and no `year`.

All **21** lower-48 requests returned **HTTP 504**, `Content-Type: text/html`, header `x-do-orig-status: 503`. Client times were **2,616–3,234 ms**. The HTML page shows `Error code: 503`, hidden text `via_upstream (503 -)`, and the sentence `App Platform failed to forward this request to the application.` No observation JSON and no `application/problem+json` body was returned. The same pattern occurred on `https://api.carawaylabs.com` for `scapularis_status` / `13081` (HTTP 504, 2,784 ms, `x-do-orig-status: 503`).

Counties attempted, all lower 48:

| Measure | County FIPS | Result on 2026-10-17 |
| --- | --- | --- |
| `scapularis_status` | `13081`, `01001`, `01003`, `04013`, `08031`, `08013`, `25025`, `37063`, `48029`, `53033` | HTTP 504 HTML |
| `burgdorferi_status` | `19135`, `12047`, `06001`, `06013`, `04013`, `08031`, `08013`, `25025`, `37063`, `48029`, `53033` | HTTP 504 HTML |

`08013` is included because an earlier API #88 receipt used it as an unapproved county. On this date it failed the same way as the previously accepted counties, so this check cannot tell whether `08013` is admitted.

A non-CDC control on the same endpoint succeeded: `measure_id=case_count_floor_2023`, `geography_id=01001`, `year=2023` returned HTTP 200 in 10,366 ms with `value_state` `MISSING`. The observation route itself was up.

### Filter errors that did return problem JSON

These are real bodies from 2026-10-17. `request_id` belongs to that call.

`year=2025` on `scapularis_status` / `13081` — HTTP 400, 116 ms, `x-do-orig-status: 400`:

```json
{
  "type": "https://carawaylabs.com/problems/unsupported-filter",
  "title": "Invalid public query",
  "status": 400,
  "detail": "CDC status is cumulative as published; omit year and use start_date=end_date=2025-12-31.",
  "instance": "/v1/observations",
  "request_id": "a7b79336-7e4d-47de-8461-c270fdad8a65",
  "code": "UNSUPPORTED_FILTER",
  "errors": null
}
```

`start_date=2025-01-01` and `end_date=2025-12-31` on the same measure and county — HTTP 400, code `UNSUPPORTED_FILTER`, same detail text. `request_id` `5ebfbe33-de29-4fa0-b814-9194821d5b26`.

`geography_id=12` (not five digits) — HTTP 400, 124 ms:

```json
{
  "type": "https://carawaylabs.com/problems/invalid-request",
  "title": "Invalid public query",
  "status": 400,
  "detail": "1 validation error for GeographyIdentity\n  Value error, county geography_id must be 5-digit FIPS [type=value_error, input_value={'geography_type': <Geogr...>, 'geography_id': '12'}, input_type=dict]\n    For further information visit https://errors.pydantic.dev/2.13/v/value_error",
  "instance": "/v1/observations",
  "request_id": "0bef8ea0-e2ce-490d-8a00-00f742fbe383",
  "code": "INVALID_REQUEST",
  "errors": null
}
```

`measure_id=not_a_measure` with a cumulative county query — HTTP 404, code `RESOURCE_NOT_FOUND`, detail `Measure has no published county observations.` Type `https://carawaylabs.com/problems/resource-not-found`. Title `Invalid public query`.

`GET /v1/sources/not-a-source` — HTTP 404, code `RESOURCE_NOT_FOUND`, detail `Source not found.`

`GET /v1/measures/not-a-measure` — HTTP 404, code `RESOURCE_NOT_FOUND`, detail `Measure not found.` Type `https://carawaylabs.com/problems/http-404`. Title `Not found`.

Five-digit `geography_id=99999` with the cumulative CDC query returned the same public HTTP 504 HTML / `x-do-orig-status: 503` pattern. That id passed the five-digit check and then failed closed. It is not evidence that `99999` is a published county.

## 4. Accepted observations from the 2026-10-12 receipt

[API #228 / API PR #231](https://github.com/Caraway-Labs/one-health-lyme-gap-atlas-api/pull/231) deployed SHA `555295f502c257adeaeafbaf323b85122e8fac26`. The handoff on WEB #578 records HTTP 200 for the seven cases below, on release `governed-2026-10-06-nlcd-demo-cohort`. This brief did not reproduce those HTTP 200 bodies on 2026-10-17.

| Measure | County FIPS | Publisher `value` | `value_state` | `normalized_state` | Receipt HTTP |
| --- | --- | --- | --- | --- | --- |
| `scapularis_status` | `13081` | `Reported` | `OBSERVED` | `detected` | 200 |
| `burgdorferi_status` | `19135` | `Present` | `OBSERVED` | `detected` | 200 |
| `burgdorferi_status` | `12047` | `No records` | `NO_RECORDS` | `unknown` | 200 |
| `scapularis_status` | `01001` | `Established` | `OBSERVED` | `established` | 200 |
| `scapularis_status` | `01003` | `Established` | `OBSERVED` | `established` | 200 |
| `burgdorferi_status` | `06001` | `Present` | `OBSERVED` | `detected` | 200 |
| `burgdorferi_status` | `06013` | `Present` | `OBSERVED` | `detected` | 200 |

The same receipt also recorded HTTP 200 for both measures at six further county FIPS: `04013`, `08031`, `25025`, `37063`, `48029`, and `53033`. That is 12 observations, two per county, not 12 more counties. The receipt says those observations include `Established` and publisher `No records`, and that `No records` stays `unknown`. It does not assign a publisher value to each FIPS. This brief does not invent that assignment.

### Producer scope versus HTTP samples

The 2026-10-12 receipt, repeated on WEB #578:

| Measure | Eligible published publisher records | Data producer admitted | Distinct public HTTP observations tested | Excluded incomplete-authority rows |
| --- | --: | --: | --: | --: |
| `scapularis_status` | 3,109 | 3,109 | 9 | 35 |
| `burgdorferi_status` | 3,109 | 3,109 | 10 | 35 |

**19** distinct public observations were tested successfully (9 tick, 10 pathogen) across **13** counties: the seven counties in the table above, plus both measures for each of the six FIPS above. It is not a claim that 6,218 HTTP requests returned 200, and it is not 19 counties. This 2026-10-17 check did not re-count producer admission.

Receipt metadata revisions, for observations on the October 6 release:

- tick: `metadata-revision:v1:c60fb91162b5ed33d34a01d3fef24e0a4a2ef8976bbd07ac1082fd783adfb509`
- pathogen: `metadata-revision:v1:01b6eaf0d3f6e96ebf8ac9020e31584f55175c95d676e40d3da7d430b9b08522`

Receipt pagination: three pages at `page_size=1` returned `01001`, then `01003`, then `13081`, once each. Page times in that receipt were 9.328 s, 10.562 s, and 5.922 s. Single-observation HTTP in that receipt was 5.984–10.344 s. This 2026-10-17 check could not repeat pagination because the cumulative reads returned 504 before a page token existed.

### Receipt excerpts

The JSON below is copied from the published receipts. Fields a comment omitted stay omitted. `01001` and `06001` have table values only; those comments did not include full JSON for them.

`scapularis_status` / `13081`, from [API #88](https://github.com/Caraway-Labs/one-health-lyme-gap-atlas-api/issues/88#issuecomment-6115665615):

```json
{
  "measure_id": "scapularis_status",
  "geography": { "geography_type": "county", "geography_id": "13081" },
  "value": "Reported",
  "value_state": "OBSERVED",
  "source_id": "tick",
  "dataset_id": "cdc-ixodes-county-status-2025",
  "semantic_version": "1.0.0",
  "metadata_revision_id": "metadata-revision:v1:c60fb91162b5ed33d34a01d3fef24e0a4a2ef8976bbd07ac1082fd783adfb509",
  "release_id": "governed-2026-10-06-nlcd-demo-cohort",
  "period_start": "2025-12-31",
  "period_end": "2025-12-31",
  "temporal_grain": "CUMULATIVE",
  "methodology_id": null,
  "methodology": null,
  "methodology_version": "tick-surveillance-v1",
  "limitations": [
    "Raw workbook, private lineage, runs, artifacts and hashes remain restricted; only the reviewed allowlisted semantic projection may reach consumers.",
    "No records, missing evidence and UNKNOWN_SOURCE_COVERAGE placeholders are unknown, never biological absence or a sampled negative.",
    "County source status does not establish prevalence, density, individual human risk or establishment thresholds.",
    "County-native publisher status does not establish sampling completeness, effort or representativeness of all habitats.",
    "Cumulative through 2025-12-31 is not an annual collection event or a current ecological conclusion.",
    "Source vintage and cumulative period are known; exact publisher publication date and retained retrieval timestamp are not asserted by this package."
  ],
  "surveillance_context": {
    "evidence": {
      "contract_version": "atlas-surveillance-evidence-v3",
      "normalized_state": "detected",
      "state": "detected_below_establishment",
      "reason_codes": ["PUBLISHER_REPORTED_ESTABLISHMENT_NOT_DOCUMENTED"],
      "evidence_tier": "GOVERNED_MAPPING",
      "observation_key": "observation:v1:9610f9b806e4abf8fa8cc5a15cbecb2697f92cef85b7ffb633a6e2497eb0014c",
      "revision_id": "revision:v1:d5ff4b13670e38aa255ec103e1b84a2ebb28cb69fd09107166ac98b8c9ff720c",
      "value_state": "OBSERVED",
      "source_rule_id": "county_tick_status:evidence-v3",
      "limitations": [
        "No qualifying record is not biological absence.",
        "Site/event evidence is not county representative.",
        "Detection alone does not establish prevalence or establishment criteria.",
        "No freshness, pooling, public admission or scientific approval is inferred.",
        "Detected; establishment criteria not documented as met in the source.",
        "Publisher cumulative Reported label for Ixodes scapularis through 2025-12-31; not a 2025 collection event.",
        "No tick count, life stage, collection date, effort, current ecological non-establishment or sampling completeness is inferred."
      ],
      "evidence_revision_id": "evidence:v3:7caed631a918f4e2f1685de43211ec0a3cdd6fa6183fbb92e710a9e8f417021c"
    },
    "methodology_comparison": null,
    "temporal_alignment": null
  }
}
```

`burgdorferi_status` / `19135`, same API #88 comment. Publisher `Present`, canonical `OBSERVED`, historical `state` `unknown`, `normalized_state` `detected`, reason `DETECTION_ESTABLISHMENT_RELATION_UNPROVEN`, `source_rule_id` `county_pathogen_status:evidence-v3`, pathogen metadata revision above. `methodology_id` and `methodology` are null. `methodology_comparison` and `temporal_alignment` are null. Observation limitations match the 13081 list. Evidence limitations are the four shared sentences in that list, without the three tick-specific sentences.

`burgdorferi_status` / `12047`, same comment. Publisher `No records`, `value_state` `NO_RECORDS`, historical `state` `no_qualifying_record`, `normalized_state` `unknown`, reason `PUBLISHER_NO_RECORDS`, same pathogen rule, versions, nulls, and limitation lists as 19135.

`scapularis_status` / `01003`, from the [WEB #578 handoff comment](https://github.com/Caraway-Labs/one-health-lyme-gap-atlas-web/issues/578#issuecomment-6119207170). The comment's limitation arrays match the 13081 observation list and the first four evidence sentences. They are not repeated here:

```json
{
  "measure_id": "scapularis_status",
  "geography": { "geography_type": "county", "geography_id": "01003" },
  "value": "Established",
  "value_state": "OBSERVED",
  "period_start": "2025-12-31",
  "period_end": "2025-12-31",
  "temporal_grain": "CUMULATIVE",
  "source_id": "tick",
  "dataset_id": "cdc-ixodes-county-status-2025",
  "semantic_version": "1.0.0",
  "methodology_version": "tick-surveillance-v1",
  "release_id": "governed-2026-10-06-nlcd-demo-cohort",
  "metadata_revision_id": "metadata-revision:v1:c60fb91162b5ed33d34a01d3fef24e0a4a2ef8976bbd07ac1082fd783adfb509",
  "source_label": null,
  "source_url": null,
  "source_published_at": null,
  "surveillance_context": {
    "evidence": {
      "contract_version": "atlas-surveillance-evidence-v3",
      "normalized_state": "established",
      "state": "established",
      "reason_codes": ["PUBLISHER_ESTABLISHED"],
      "value_state": "OBSERVED",
      "limitations": [
        "No qualifying record is not biological absence.",
        "Site/event evidence is not county representative.",
        "Detection alone does not establish prevalence or establishment criteria.",
        "No freshness, pooling, public admission or scientific approval is inferred."
      ]
    }
  }
}
```

`burgdorferi_status` / `06013`, same WEB #578 comment: `value` `Present`, `value_state` `OBSERVED`, `source_id` `pathogen`, `dataset_id` `cdc-ixodes-pathogen-status-2025`, the pathogen metadata revision, null `source_label` / `source_url` / `source_published_at`, historical `state` `unknown`, `normalized_state` `detected`, reason `DETECTION_ESTABLISHMENT_RELATION_UNPROVEN`. The same observation and four evidence limitations are in that comment. `methodology_comparison` and `temporal_alignment` are not keys in that excerpt.

## 5. Field distinctions

Live `Observation` and `SurveillanceEvidenceContext` schemas, applied to the fields the receipts actually populated.

| Field | What the contract says it is |
| --- | --- |
| `value` | Publisher value. Read with `value_state` and `unit`. Null never means zero. CDC receipt strings: `Reported`, `Established`, `Present`, `No records`. |
| `value_state` | Public enum: `OBSERVED`, `ZERO`, `MISSING`, `SUPPRESSED`, `UNAVAILABLE`, `NO_COUNTY_LINKED_RECORD`, `NO_RECORDS`. Schema text: `OBSERVED` is nonzero; `NO_RECORDS` retains CDC's `No records`. Neither establishes biological absence. |
| `surveillance_context.evidence.state` | Historical evidence state. Enum: `established`, `detected_below_establishment`, `sampled_not_detected`, `no_qualifying_record`, `unknown`. |
| `surveillance_context.evidence.normalized_state` | Data-owned county evidence state, projected without API classification. Enum: `established`, `detected`, `unknown`, or null. `unknown` supports no biological-absence conclusion. The publisher value stays on `value`. |
| `surveillance_context.evidence.value_state` | Evidence copy of the canonical value state. On the excerpts it matches the observation `value_state`. |
| `reason_codes` | Non-empty string array on the evidence object. |
| `evidence_tier` | Const `GOVERNED_MAPPING` in the live schema. Populated on the API #88 excerpts. |
| `metadata_revision_id` | Reviewed consumer-safe metadata revision. Nullable. Not private lineage. |
| `release_id` | Governed release identity. Receipt observations use the October 6 release. Live measure and source resources use the October 15 release. |
| `semantic_version` | Governed semantic contract version, separate from HTTP `/v1` and the application version. `1.0.0` on receipt observations. `2.0.0` on live measure and source resources. |
| `methodology_version` | Transformation version. Receipt value `tick-surveillance-v1`. Distinct from a methodology resource id. |
| `methodology_id`, `methodology` | Resource id and text. Null on the API #88 observation excerpts and on the live measure payloads' `methodology_id`. Live measures do carry short `methodology` strings (`source-native status mapping`, `distinct pathogen mapping`). |
| `period_start`, `period_end`, `temporal_grain` | Receipt observations: both dates `2025-12-31`, grain `CUMULATIVE`. |
| `source_id`, `dataset_id` | Public source key (`tick` or `pathogen`) and dataset id. `source_id` is distinct from `lineage_source_id` and `dataset_id`. |
| `lineage_source_id` | Present on the live source resources as `cdc_arbonet_tick_module`. The observation schema allows it. The published excerpts omit it. |
| `limitations` | One list on the observation and another on `surveillance_context.evidence`. Both appeared on the excerpts. |
| `surveillance_context.methodology_comparison` | Nullable. Null on the API #88 excerpts. |
| `surveillance_context.temporal_alignment` | Nullable. Null on the API #88 excerpts. Schema text: comparison is case-definition scope only; alignment is descriptive, not causal. |
| `observation_id`, `provenance_ref`, `evidence` | Required on `Observation`. `evidence` is an `EvidenceReference` (`resource_type`, `resource_id`, plus optional source, provenance, versions, release, uri). The published excerpts omit these top-level fields. Evidence identity that **is** in the API #88 excerpts sits under `surveillance_context.evidence` as `observation_key`, `revision_id`, and `evidence_revision_id`. |

Receipt pairs where historical `state` and current `normalized_state` differ:

| Case | Publisher `value` | Historical `state` | `normalized_state` |
| --- | --- | --- | --- |
| `scapularis_status` `13081` | `Reported` | `detected_below_establishment` | `detected` |
| `burgdorferi_status` `19135` and `06013` | `Present` | `unknown` | `detected` |
| `burgdorferi_status` `12047` | `No records` | `no_qualifying_record` | `unknown` |
| `scapularis_status` `01003` | `Established` | `established` | `established` |

`Reported` is publisher tick reporting. On the 13081 excerpt the evidence limitations say establishment criteria were not documented as met. `Present` supports pathogen detection on these excerpts. `normalized_state` `detected` is not a prevalence or individual-risk result. `No records` uses canonical `NO_RECORDS` and normalized `unknown`. The live measure text says `No records is not absence.`

An observation that the API does not deliver is a different outcome from `NO_RECORDS`. The public failure mode verified on 2026-10-17 is HTTP 504 HTML, not an observation with `value` `No records`.

Private workbook bytes, row hashes, internal run and artifact ids, and restricted record identities are not fields this brief can show. They are absent from the published sanitized excerpts. This check did not receive a CDC observation body in which to look for them.

## 6. Coverage, unavailability, and the gateway

| Situation | Verified behavior |
| --- | --- |
| Cumulative query, five-digit lower-48 FIPS, either CDC measure, 2026-10-17 | Public HTTP 504 `text/html`, `x-do-orig-status: 503`. No problem JSON. Applies to counties the October 12 receipt had accepted. |
| `year` or a date range other than the single cumulative day | HTTP 400 `UNSUPPORTED_FILTER` with the CDC detail quoted above. Fast (about 100 ms). |
| County id that is not five digits | HTTP 400 `INVALID_REQUEST`. |
| Unknown measure or source id | HTTP 404 `RESOURCE_NOT_FOUND` with the details quoted above. |
| Excluded `UNKNOWN_SOURCE_COVERAGE` | No lower-48 example exists. The October 12 receipt says the excluded rows are outside the lower 48 and must stay unavailable. They must not be turned into `No records` or a negative evidence claim. This check did not call counties outside the lower 48. |
| October 12 accepted observations | HTTP 200 only in that receipt, on the October 6 release. Not reconfirmed as current responses. |
| Producer admission of 3,109 rows per measure | Receipt count. Not re-counted by HTTP on 2026-10-17. |

Live OpenAPI still documents HTTP 503 `application/problem+json` for service unavailable, with an illustrative `code` of `SERVICE_UNAVAILABLE` and an illustrative `type` of `https://carawaylabs.com/problems/http-503`. This check did not receive that body for any CDC observation.

[API #88](https://github.com/Caraway-Labs/one-health-lyme-gap-atlas-api/issues/88) remains open. Its acceptance note is that the application can complete an unavailable CDC read as HTTP 503 `application/problem+json`, while the public gateway answers HTTP 504 HTML and sets `x-do-orig-status: 503`. That gateway substitution was still visible on 2026-10-17: every CDC observation in this check had public status 504 and origin status 503. The HTML page prints `Error code: 503` while the HTTP status line is 504.

[API #246](https://github.com/Caraway-Labs/one-health-lyme-gap-atlas-api/issues/246), opened 2026-10-17, describes a further production failure on the same public symptom. Its diagnosis comment says the current metadata release is `governed-2026-10-15-january-climate-prod` and the deployed CDC adapter still requires `governed-2026-10-06-nlcd-demo-cohort`, rejecting the request before a producer call with a structured 503. This brief did not read that adapter. The public evidence here matches the symptom: metadata is the October 15 release, CDC cumulative reads fail in about 2.6–3.2 seconds (too fast for the October 12 producer reads of about 6–10 seconds), and the body is gateway HTML rather than problem JSON. API #246 also says county detail still returns status strings. That legacy county resource is outside the endpoints in this brief. It is not a substitute observation contract, and this document does not propose using it as one.

API #246's recovery was not in production at the time of these calls. Later comments on that issue say production had not been restored.

## 7. Questions for product requirements

These are open questions. They are not UI decisions.

1. The current public metadata release is `governed-2026-10-15-january-climate-prod`, and cumulative CDC reads against it returned HTTP 504 on 2026-10-17. The HTTP 200 samples belong to the older `governed-2026-10-06-nlcd-demo-cohort` release. They record that older release only and do not stand in for current observations. What must this current release return before a requirement treats a CDC county observation as available?
2. What API response must exist before a consumer is allowed to show an observation, given that the documented cumulative read currently returns gateway HTML?
3. How should requirements name the separate facts that already diverge in real payloads: publisher `value`, canonical `value_state`, historical `evidence.state`, and `normalized_state`?
4. Source resources retrieved on 2026-10-17 have a CDC dataset URL and vintage `through 2025-12-31`. October 12 observation excerpts have null `source_label`, `source_url`, and `source_published_at`. Which of those fields are in the requirement, once observation JSON is available again?
5. The live pathogen source limitation says `33 absent canonical counties`. The October 12 receipt and the API #246 reconciliation notes say `35` excluded rows per measure. Which count is the requirement bound to?
6. Is `pacificus_status`, present on `tick_surveillance`, in a later capability brief? It is not specified for this one.
7. What requirement can be written for excluded `UNKNOWN_SOURCE_COVERAGE` while no lower-48 example exists?
8. OpenAPI allows 1–500 county ids per observations request. The October 12 receipt certified bounded county reads, not a 500-county latency ceiling. API #246 reports multi-county batches hitting the same gateway failure. Which batch sizes are in scope?

## 8. Contradictions and gaps

Verified against the live document and live calls unless a row says the source is a receipt or an API issue comment.

| Topic | What disagrees |
| --- | --- |
| Current observation delivery | Live OpenAPI tells clients to call the cumulative CDC query. On 2026-10-17 that query returned HTTP 504 HTML for every lower-48 county tried, including the seven previously accepted counties. |
| API #88 gateway | The contract's unavailable response is HTTP 503 `application/problem+json`. The public edge returns HTTP 504 `text/html` with `x-do-orig-status: 503`. Unresolved on API #88. Also the transport symptom on API #246. |
| Release gate | Live metadata release is 15 October 2026 climate production. HTTP 200 CDC observations in the receipt are bound to the 6 October 2026 release. API #246's diagnosis says the deployed adapter still requires the older release and rejects the read before a producer call. Not re-verified from source in this repo. |
| Exclusion count | Live `GET /v1/sources/pathogen` limitation says 33 absent canonical counties are unknown source coverage. Receipts say 35 excluded incomplete-authority rows per measure. |
| Problem `type` URLs | Live 400 responses use `https://carawaylabs.com/problems/unsupported-filter` and `https://carawaylabs.com/problems/invalid-request`. The OpenAPI illustrative 400 example uses `https://carawaylabs.com/problems/http-400` and a generic detail string. Live 404 measure-lookup uses `https://carawaylabs.com/problems/http-404`; live unknown-source and unknown observation-measure responses use `https://carawaylabs.com/problems/resource-not-found`. |
| Semantic version | Receipt observations: `1.0.0`. Live measures, indicators, and sources: `2.0.0`. |
| Source URL on the observation | Null on the October 12 observation excerpts. Populated on the live source resources. Observation-level nullability was not rechecked, because no CDC observation JSON came back. |
| Stale API #88 doc | [docs/api-88-production-cdc.md](https://github.com/Caraway-Labs/one-health-lyme-gap-atlas-api/blob/main/docs/api-88-production-cdc.md) on API `main` still says only the original three memberships are enabled and that other CDC counties return 503. API #228 later recorded 3,109 admitted rows per measure. Current public behavior matches neither sentence: the three original counties also returned gateway 504 on 2026-10-17. |
| Pinned Web contract | `contracts/public-openapi.json` in this repo hashes to `fe4f00e60af337f1b99e6293dc973c290541881d4845355fc80e20b57fcb1fa0` and does not contain the live CDC cumulative-date sentence. This brief does not regenerate that contract. The generated pages under `content/docs/api-reference` follow the pinned file, not the live document retrieved here. |
| `UNKNOWN_SOURCE_COVERAGE` example | No lower-48 county is available to show the excluded placeholder. Behavior for that class was not called. |
| Pagination and the 3,109-row scope | Documented in OpenAPI and in the October 12 receipt. Not re-executed on 2026-10-17. |
| `methodology_comparison` and `temporal_alignment` | Null in the October 12 excerpts. Live object schemas exist. No current CDC observation was available to see whether they are still null. |

## Scope held

No Web UI, client regeneration, map behavior, scientific classifier, or new CDC admission is specified or changed here. API #88's gateway behavior is recorded as an API-owned defect.
