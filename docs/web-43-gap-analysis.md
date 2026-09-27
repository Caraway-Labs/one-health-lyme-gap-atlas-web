# Web #43 current-main gap analysis

Baseline: web `origin/main` at `54ba53c867c93c00df388973f919c712b5703fed`; API #14 merged contract at API `origin/main` `131279f27f10632684cac400ac7a739eb3643d44`. Compared with Web #43, KG #3, existing EvidenceChat, Assistant demo, browser storage, feedback, and tests before editing.

| Requirement | Current-main finding | Classification |
| --- | --- | --- |
| Live literature chat surface and feature gate | `/knowledge-graph` and drawer already render `EvidenceChat`, use generated API caller and Zod response validation, with `NEXT_PUBLIC_KG_CHAT_ENABLED` | Already implemented; keep existing component/route |
| Assistant demo | `/assistant` is fixture-only and separately gated | Already implemented; route consolidation deferred to Web #271 |
| Submission, idle/loading, local history | EvidenceChat supports submission, status text, five local conversations/30 days, new/select/delete/clear | Implemented; continuation currently requires stored server capability token |
| Answer and citations | Renders answer and rich PMID/PMCID/section/corpus details, with source-paper link | Implemented; simplify default citations and add source/evidence labels |
| API contract | `contracts/openapi.json` and generated client/Zod predate API #14 fields | Missing synchronization |
| Response states | 503 typed bodies are lost by generic mutator error; no separate no-evidence, unavailable, capacity, refusal, validation, or retry UX | Missing/refinement |
| Accessibility and responsive layout | Semantic form/labels, dialog keyboard handling, status and alert nodes, responsive CSS exist | Implemented; extend focused coverage for result transitions and links |
| Feedback/analytics | Shared Feedback derives `evidence_library` route context; chat controls use allowlisted analytics IDs without prompts | Already implemented; preserve |
| Structured data/Both and navigation consolidation | Not functional; Web #271/API #100 own future mode and canonical route | Intentionally deferred |

Scope: extend `EvidenceChat` and browser-local storage, update the generated API contract/client, and test the literature flow. Preserve the existing route, feature gate, feedback integration, 5-conversation/30-day retention, and no prompt-bearing analytics. Do not change the fixture-only Assistant demo or navigation in this story.
