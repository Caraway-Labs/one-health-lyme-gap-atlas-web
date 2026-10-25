# Syncing API contracts into the web repository

The web repository pins two API documents. Copy both from the same commit of `Caraway-Labs/one-health-lyme-gap-atlas-api`. Do not download them from a running server, and do not hand-edit the JSON or anything under `src/generated/` or `content/docs/api-reference/`.

| Pin | API file | Used by |
| --- | --- | --- |
| `contracts/openapi.json` | `first-party-openapi.json` | `npm run generate:api` (`orval.config.ts`) regenerates `src/generated/` |
| `contracts/public-openapi.json` | `openapi.json` | `npm run docs:api` regenerates `content/docs/api-reference/` |

`contracts/openapi.json` is the complete first-party product contract. It includes internal routes, including `POST /v1/knowledge-graph/chat`. The public file omits those routes. Oxfmt does not format either pin (`oxfmt.config.ts`).

`contracts/public-openapi.manifest.json` records the API commit (`sourceCommit`) and the SHA-256 of the pinned public file bytes (`sha256`), plus `openapi` and `infoVersion` from that document. `sourceRepository`, `sourcePath`, and `sourceUrl` stay `Caraway-Labs/one-health-lyme-gap-atlas-api`, `openapi.json`, and `https://api.onehealthatlas.org/openapi.json`.

Do not put credentials, Snowflake access, or query logic in the browser. Runtime handling of an undocumented HTTP status stays in application code. For Ask Atlas, the 503 and 504 fallbacks in `src/components/evidence-chat/client-failure.ts` stay in place when the documented chat responses change.

## Source

- Repository: `Caraway-Labs/one-health-lyme-gap-atlas-api`
- Branch: `main`
- Last sync: `f485d5ef756ac7ae3cebf864535a8e1c0e417f9e` (2026-10-24). That commit is the merge of API pull request #346. Both pins are the files at that commit.
- Previous first-party pin: `a84c82d3b2f1acaa32c81194388cbaa72e1fd374`, identical to `3897bb18cfdc7cc26892b08b6e74bc6cc347834c` (typed Ask Atlas outcomes on HTTP 200).
- Previous public pin: `e88887877440c00de0e23301f0a3eac2353134d9`.

Record the exact API commit in the pull request that updates the pins. Update the "Last sync" line in this file in the same change.

## Procedure

1. Fetch `main` on the API repository and choose one full commit SHA. Use the same commit for both files.
2. Download `first-party-openapi.json` and `openapi.json` at that commit.
3. Compare each download with the current pin: paths, then component schemas, then the remaining top-level fields. Accept the download only after every difference is reviewed. When unrelated differences are not part of the change, choose an earlier commit that still contains the intended change, or stop.
4. Replace `contracts/openapi.json` and `contracts/public-openapi.json` with those downloaded bytes. The API export is JSON with two-space indentation and a trailing newline. Keep those bytes. Do not reformat or delete an operation by hand.
5. Set the manifest `sourceCommit` to that SHA and `sha256` to the lowercase SHA-256 of `contracts/public-openapi.json`. Set `openapi` and `infoVersion` from the public document.
6. Run `npm run generate:api` and `npm run docs:api`.
7. Review `git diff -- contracts src/generated content/docs/api-reference`. Generated types, Zod schemas, and reference pages change only for the differences accepted in step 3.
8. Run `npm run generate:api` again. `git diff --exit-code -- contracts src/generated` must be empty. That is the same check CI runs after `npm ci`. `npm run docs:api:check` must pass.

## Production drift

`npm run docs:api:drift` retrieves `https://api.onehealthatlas.org/openapi.json` and compares it with the manifest checksum. It does not rewrite the pin, the manifest, or the generated pages. A pin copied from an API commit that production does not yet serve fails that check until the live document matches. The weekly Public OpenAPI drift workflow is that maintainer signal. A drift failure is not a reason to revert a reviewed pin.

## Geography identity at the last sync

`GET /v1/geographies/{geography_type}/{geography_id}` (`geography_v1_geographies__geography_type___geography_id__get`), on both pins:

- `200` is `anyOf` [`ResourceEnvelope_Geography_`, `GeographyUnavailable`]. While canonical identity delivery is unpublished, the body is `availability: "UNAVAILABLE"`, `reason: "CANONICAL_GEOGRAPHY_UNPUBLISHED"`, `data: null`, the echoed `geography` identity, and a non-empty `limitations` list. `Cache-Control: no-store`.
- `503` is not a documented response. `422` is not a documented response.
- `400`, `404`, `413`, `414`, and `429` are unchanged.
- The `geographies` tag description is "Typed geography identity; canonical delivery pending (200 UNAVAILABLE)."

`GeographyUnavailable` is a new component schema on both pins.

## Other difference accepted with this sync

`GET /health/ready` exists only on the first-party pin. Its `200` schema is now `ReadinessResponse` (with `ReadinessDependencies`) instead of an inline object. That schema arrived in API #310 and is present in `f485d5ef`. The public document has no health routes, so this difference is not in `contracts/public-openapi.json`.

API commits after `f485d5ef` are not in these pins. They include `GET /v1/atlas/map-values` (#363) and description-only OpenAPI edits (#364, #365, #366).

## Ask Atlas chat contract

Already present in the previous first-party pin, and unchanged at this sync. `POST /v1/knowledge-graph/chat` (`knowledge_graph_chat_v1_knowledge_graph_chat_post`):

- `200` describes the five typed `status` values (`answered`, `no_evidence`, `safety_refusal`, `evidence_unavailable`, `capacity_limited`) and declares a `Retry-After` header. `KnowledgeChatResponse` itself is unchanged.
- `503` is not a documented response.
- `422` and `429` are unchanged.
