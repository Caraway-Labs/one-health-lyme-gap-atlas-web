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
- Last sync: `9d137a895576310dfa84e0d17fc297bffe326ebe` (2026-10-25). That commit is the API SHA production serves. The public pin matches live `https://api.onehealthatlas.org/openapi.json`. Both pins are the files at that commit.
- Previous pins: `c410a889b2234dac377139e99b6d581fc31a6452` (2026-10-25).

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

## Contract at this sync

Every operation ID is `verbNoun` camelCase. Public examples include `getAtlasMetadata`, `getAtlasMapValues`, `listObservations`, `checkCountyTier1Availability`, `downloadCountyReport`, and `checkGeographyAvailability`. The first-party chat operation is `askKnowledgeGraph`.

Paths added since `f485d5ef`:

- `GET /v1/atlas/map-values` (`getAtlasMapValues`) on both pins.
- `GET /v1/intelligence/feed/{item_id}` (`getIntelligenceFeedEntry`) on the first-party pin only.

The public document carries `x-codeSamples` on every public operation. The first-party pin does not.

Inline 200 schema titles on this pin:

- `GET /v1/observations`: `Observation collection response`
- `GET /v1/geographies/{geography_type}/{geography_id}`: `Geography response`
- `GET /health/live` (`checkLiveness`), first-party pin only: `Liveness response`

`FeedEntry` on the first-party pin requires `source_family_label`, the display label for `source_family`. The public pin has no intelligence feed.

`GET /v1/intelligence/feed` (`listIntelligenceFeed`), first-party pin only, orders entries with a publisher date newest first. Entries with an unknown publisher date are last. Matching publisher dates use a stable tie-break of item id, revision id, source id, and registry version.

`GET /v1/geographies/{geography_type}/{geography_id}` (`getGeography`), on both pins:

- `200` is `anyOf` [`ResourceEnvelope_Geography_`, `GeographyUnavailable`], titled `Geography response`.
- Documented status codes are 200, 400, 404, 413, 414, and 429.

`GET /health/ready` (`checkReadiness`) and `POST /v1/knowledge-graph/chat` (`askKnowledgeGraph`) stay on the first-party pin only. The chat operation documents 200, 422, and 429.
