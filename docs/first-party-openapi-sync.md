# Syncing the first-party API contract

`contracts/openapi.json` is the byte-for-byte pin that `npm run generate:api` (`orval.config.ts`) uses to regenerate `src/generated/`. It is the API repository's `first-party-openapi.json`, not the public `openapi.json`. The public file omits internal routes, including `POST /v1/knowledge-graph/chat`. Oxfmt does not format the pin (`oxfmt.config.ts`).

Do not hand-edit `src/generated/`. Do not put credentials, Snowflake access, or query logic in the browser. Runtime handling of an undocumented HTTP status stays in application code. For Ask Atlas, the 503 and 504 fallbacks in `src/components/evidence-chat/client-failure.ts` stay in place when the documented chat responses change.

## Source

- Repository: `Caraway-Labs/one-health-lyme-gap-atlas-api`
- Branch: `main`
- File: `first-party-openapi.json`
- Last sync: `a84c82d3b2f1acaa32c81194388cbaa72e1fd374` (2026-10-24). That file is identical to `3897bb18cfdc7cc26892b08b6e74bc6cc347834c`, the merge that moved typed Ask Atlas outcomes to HTTP 200.

Record the exact API commit in the pull request that updates the pin. Update the "Last sync" line in this file in the same change.

## Procedure

1. Fetch `main` on the API repository and note the full commit SHA.
2. Download `first-party-openapi.json` at that commit. Do not download `openapi.json` for this pin.
3. Compare the download with `contracts/openapi.json` path by path, then component schemas and the remaining top-level fields. Copy only the operations and schemas you have reviewed. Leave unrelated API changes out of the pin.
4. Write the reviewed document as JSON with two-space indentation and a trailing newline. That formatting matches the current pin, so an unchanged operation stays byte-stable.
5. Run `npm run generate:api`.
6. Review `git diff -- contracts src/generated`. Confirm that generated types and Zod schemas change only for the operations you copied.
7. Run `npm run generate:api` again. `git diff --exit-code -- contracts src/generated` must be empty. That is the same check CI runs after `npm ci`.

## Ask Atlas chat contract at the last sync

`POST /v1/knowledge-graph/chat` (`knowledge_graph_chat_v1_knowledge_graph_chat_post`):

- `200` describes the five typed `status` values (`answered`, `no_evidence`, `safety_refusal`, `evidence_unavailable`, `capacity_limited`) and declares a `Retry-After` header. `KnowledgeChatResponse` itself is unchanged.
- `503` is not a documented response.
- `422` and `429` are unchanged.
