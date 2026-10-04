# UX Reset constitution (Atlas professional workspace)

**Canonical guidance for humans and coding agents.** New UX Reset stories, epics, and pull requests should link here instead of restating product rules in issue comments.

| Field | Value |
| --- | --- |
| Status | Accepted for UX Reset Phase 1 encoding ([issue #407](https://github.com/Caraway-Labs/one-health-lyme-gap-atlas-web/issues/407)) |
| Parent epic | [#394 — Establish the UX Reset professional workspace foundation](https://github.com/Caraway-Labs/one-health-lyme-gap-atlas-web/issues/394) |
| Last updated | 2026-10-04 |
| Companion docs | [DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md) (tokens and primitives), [helpdocs-phase1-content-contract.md](./helpdocs-phase1-content-contract.md) (public HelpDocs interpretation), [assistant-entry-points.md](./assistant-entry-points.md) (legacy assistant surfaces) |

## Sources and gaps

Approved product decisions in this document are drawn from:

1. **Epic #394** — explicit approved decisions and acceptance criteria (repository issue).
2. **Atlas Lyme UI Reset Workshop — 2026-10-03** — cited as the decision source in epic #394.

**Not found in this repository:** a standalone workshop transcript, slide deck, or pre-issue “UX constitution” file. If workshop detail beyond epic #394 is required, obtain it from the workshop owners; **do not invent new product decisions** to fill gaps. Escalate conflicts to the epic owner instead of guessing.

## Agent and contributor governance

Coding agents and contributors **must not reopen settled UX Reset product decisions** without an explicit, owner-approved issue or ADR. That includes:

- Renaming or replacing **Available / Limited / Unavailable** as the top-level evidence vocabulary.
- Adding **general contextual help**, tooltips tours, or inline “?” help systems in Reset V1.
- Expanding **Ask Atlas** into navigation, page composition, or autonomous workflow execution.
- Treating **review priority** or map color as **disease risk**, burden, or individual exposure.
- Coercing **missing, suppressed, or unavailable** values into **zero**.
- Turning **Explore, Review, Investigate, Compare, or Action** into catch-all screens that duplicate other destinations.
- Adding **saved-work libraries**, artifact history, or **autonomous assistant** scope to Reset V1 unless explicitly approved.
- **Deleting or redirecting legacy routes** as part of Reset work (legacy stays available until a later cutover decision).
- Introducing a **second design system** or chrome color scheme instead of [DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md) tokens and `src/components/ui` primitives.

When implementation detail is unspecified, prefer **lean delivery**: smallest change that satisfies the story, reuse tokens and patterns first, and defer scope that epic #394 lists as out of scope.

## Lean development rule

Reset V1 is governed by **lean development**:

- Build the **authenticated professional workspace** on new routes (recommended namespace `/app/*`) without requiring legacy pages to be redesigned first.
- **Reuse** Next.js, Tailwind, shadcn/Base UI, and existing Atlas domain patterns when that reduces effort; **do not inherit** legacy page architecture merely for parity.
- **Preserve meaning** across pages (geography, release, review scope, compare selections), not every legacy control or layout.
- No **public front porch**, onboarding, saved-work, artifact management, developer portal, or broad legacy cosmetic refactors in Phase 1 unless a separate approved story says otherwise.

## Phase boundaries

| Phase | In scope | Out of scope (unless a new approved story says otherwise) |
| --- | --- | --- |
| **UX Reset Phase 1** | Authenticated professional workspace shell; Review, Explore, Investigate, Compare, Action, Assistant, Settings, Docs destinations; bounded context handoff; shared evidence/provenance presentation; constitution encoded in repo guidance | Public scrollytelling front porch; new-user onboarding; saved-work library; general contextual-help system; legacy route removal |
| **Phase 2 (planned)** | Public front porch and onboarding per epic #394 | — |

**Reset V1 product posture:** professional workspace **requires authentication**. Unauthenticated users use existing sign-in and return to the intended destination. Geography is **national → state → county** as one hierarchy; default jurisdiction is **starting context**, not an access gate.

## Evidence states: Available, Limited, Unavailable

These three labels are the **top-level evidence states** for Reset UX copy, badges, and summaries. They are distinct from legacy county-panel micro-states (`observed` / `missing` / `unavailable` in `county-evidence-panel.tsx`) but must **map honestly**:

| State | Meaning for users | Implementation notes |
| --- | --- | --- |
| **Available** | Governed inputs exist for the claim at the stated geography and period; Atlas can show values with provenance. | Prefer “Observed or published” where legacy panels already distinguish a real zero from absence. |
| **Limited** | Some governed signal exists but coverage, sample size, staleness, or methodology limits how strongly it should be read. | Align with literature chat `limited` and “Limited evidence” source labeling where applicable. |
| **Unavailable** | Metadata or values are absent, invalid, out of release scope, or not yet loaded—Atlas **does not guess**. | Show **Unavailable**, not `0`, not em dash masquerading as zero, not silent omission. |

### Missing is not zero

- **Observed or published zero** (for example `0` published county-linked cases) is a valid **Available** outcome and must stay visually and verbally distinct from **missing** or **unavailable** human evidence.
- Copy pattern (legacy reference): *“Missing, suppressed, or unallocated records are not converted to zero.”* ([`county-evidence-panel.tsx`](../src/components/county-evidence-panel.tsx), [`atlas-release-education-content.ts`](../src/lib/atlas-release-education-content.ts))
- Filters and charts must not treat null, suppressed, or not-reported cells as numeric zero without an explicit, governed rule.

### Review priority is not disease risk

- The **county review score** and **review-priority** map ramp (`.priority-pill`, `--map-ramp-*`, `AtlasPriorityBadge`, `AtlasMapLegend`) express **follow-up investigation priority** within a governed release—not individual risk, diagnosis, exposure location, or predicted case counts.
- Do not describe priority color as “hotter = more dangerous for residents.” Editorial and education copy must keep **signal / evidence / investigation priority** language ([`atlas-release-education-content.ts`](../src/lib/atlas-release-education-content.ts)).

## Semantic color and anti-patterns

Use [DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md): **semantic chrome tokens** for UI chrome; **domain/viz tokens** for maps, evidence, rankings, and severity.

| Do | Don’t |
| --- | --- |
| `var(--primary)`, `var(--muted)`, shadcn `Button` / `Badge` / `Card` for chrome | Hardcoded hex in feature components (enforced by `npm run check:design-system`) |
| `--map-ramp-*`, `--priority-*`, `.priority-pill` for review priority and map legend | Flatten map or priority meaning into `primary` or generic success/warning |
| `AtlasDataStamp`, `MethodsSection`, release education for provenance | Invent ad-hoc “source: unknown” without **Unavailable** semantics |
| `AtlasStatusMessage` for honest loading / error / empty | Skeleton layouts that imply data where API returned unavailable |
| Short motion per `--motion-duration*`; honor `prefers-reduced-motion` | Decorative motion, parallax, or long transitions on data state changes |

**Anti-patterns (reject in review):**

- Using **red/green** as if Atlas were a clinical risk dashboard.
- One **mega-page** that combines ranking, deep county narrative, compare matrices, and action plans because “users might need it.”
- **Contextual help** popovers, coach marks, or site-wide “?” widgets in Reset V1 (see below).
- **Ask Atlas** buttons that auto-navigate, pre-fill filters, or run workflows without explicit user navigation.

## Provenance layering

Present provenance in **layers** so users can stop at the depth they need; do not hide IDs required for reproducibility.

1. **Snapshot** — what release and methodology am I viewing? (`AtlasEvidenceSnapshot`, evidence snapshot copy).
2. **Source periods and scope** — what geography and upstream vintages fed the release? (metadata, `AtlasFilters`, release semantics dictionary).
3. **Methodology** — how were inputs combined? (methodology version, scoring explainer; separate from source observation dates).
4. **Limitations** — coverage, suppression, and interpretive bounds (always reachable when a page makes evidentiary claims).
5. **Technical disclosure** — release ID, methodology ID, load/generation timestamps when missing values would otherwise be guessed.

If a layer is unknown, show **Unavailable** at that layer rather than interpolating ([`atlas-release-education-content.ts`](../src/lib/atlas-release-education-content.ts)).

## Motion restraint

- Use existing motion tokens (`--motion-duration-fast`, `--motion-duration`) and global reduced-motion rules in `globals.css`.
- Motion may orient (panel open, focus move) but must not **animate severity** or **imply rising risk** through color pulsing or chart theatrics.
- Prefer instant or near-instant updates when evidence state changes (Available → Unavailable).

## Page jobs (do not merge destinations)

Each primary destination has **one job**. Cross-links and shared context hand off work; they do not duplicate full workflows.

| Destination | Job | Owns | Must not become |
| --- | --- | --- | --- |
| **Review** | See what merits attention **now** in scope (national/state/county lists, priority ordering). | Ranking tables, scope selectors, entry to county detail | Full investigation narrative, compare matrices, or export center |
| **Explore** | **Discover patterns** geographically and across measures (maps, distributions, explorer views). | Map/table parity, filters, shareable URL state | County action plans, literature chat, or settings |
| **Investigate** | **Deep read** on one geography’s evidence bundle and interpretation. | County evidence panels, methodology context, justified follow-up questions | National compare grid or workspace administration |
| **Compare** | **Contrast a small set** of places on agreed measures. | Side-by-side metrics, aligned release/methodology | Open-ended dashboard or second Explore |
| **Action** | **Bounded next step** (who does what, official resources)—not autonomous execution. | Role/action pairing, guarded plans, links out | Scraping Action into Investigate or hiding provenance |
| **Assistant (Ask Atlas)** | **Answer-only** grounded responses; user stays in control of navigation. | Attributed answers, source lists, conversation in assistant shell | Auto-routing, changing filters/maps, or running workflows |
| **Settings** | Account, preferences, data rights | Profile and governance utilities | Analytics configuration surface for epidemiology |
| **Docs** | Stable product and trust documentation | Links to `/docs`, privacy, responsible use | Inline replacement for Investigate |

**Assistant / Ask Atlas (Reset rule):** answer-only; **the user navigates**. Do not add assistant-driven page transitions, silent context mutation, or “do this for me” automation in Reset V1. Legacy launcher behavior remains documented in [assistant-entry-points.md](./assistant-entry-points.md) until reset assistant stories supersede it.

## No contextual help in Reset V1

**Decision:** Reset V1 does **not** include a general contextual-help system (tooltips tours, field-level “?” help, smart tips, or a help drawer tied to every control).

- Product orientation belongs in **Docs** (`/docs`) and explicit **empty/loading/error** copy on each page.
- Do not add a parallel help framework in `src/features` for Reset routes.
- UX Lab prototypes under `/ux-lab/*` are **disposable references**, not approval to ship contextual help in production Reset routes.

## Design system first

Before new Reset UI:

1. Read [DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md) and run `npm run check:design-system`.
2. Compose from `src/components/ui` and existing `atlas-*` patterns.
3. Keep MapLibre as the geo renderer; keep scoring/filter/geography logic out of `src/components/ui`.
4. Run `npm run check:ux-reset` when touching Reset guidance or agent rules.

## Legacy vs Reset routes

- **Legacy** production routes (for example `/`, `/geographic_explorer`, `/investigate`) remain available as reference until an explicit cutover.
- **Reset** professional routes live under the agreed namespace (for example `/app/*`) and follow this constitution even when legacy behavior differs.
- Do not delete or redirect legacy URLs as part of constitution or Phase 1 shell work.

## Checklist for new Reset stories

- [ ] Links to this document for product rules
- [ ] Page job matches exactly one primary destination
- [ ] Evidence states use Available / Limited / Unavailable honestly
- [ ] Provenance layers reachable for evidentiary claims
- [ ] Tokens/primitives from DESIGN_SYSTEM; no second chrome palette
- [ ] No contextual-help scope creep; no Ask Atlas navigation side effects
- [ ] Lean V1 scope; no saved-work or artifact library unless approved
